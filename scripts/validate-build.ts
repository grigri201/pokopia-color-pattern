import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import {
  validateCompactItemsData,
  validateItemColorsData,
  validatePokemonIndexData,
  validateRecommendationsData,
  type SchemaIssue,
} from "../src/data/schemas.js";

type ValidationIssue = {
  file: string;
  message: string;
};

const compactItemsPath = "generated/data/compact-items.json";
const itemColorsPath = "generated/data/item-colors.json";
const pokemonIndexPath = "generated/data/pokemon-index.json";
const recommendationsDir = "generated/data/recommendations";
const runtimeDataPaths = [compactItemsPath, itemColorsPath, pokemonIndexPath];
const compactGzipLimit = 50 * 1024;
const recommendationGzipLimit = 5 * 1024;
const projectRoot = process.cwd();
const distOnly = process.argv.includes("--dist");
const issues: ValidationIssue[] = [];

if (distOnly) {
  await validateDistOutput();
} else {
  await validateGeneratedDataGate();
}

if (issues.length > 0) {
  console.error(distOnly ? "Build output validation failed" : "Build validation failed");
  issues.forEach((issue) => console.error(`- ${issue.file}: ${issue.message}`));
  process.exitCode = 1;
} else {
  console.log(distOnly ? "Validated dist output for private data and secrets." : "Validated compact data size, determinism, schemas, and runtime boundaries.");
}

async function validateGeneratedDataGate(): Promise<void> {
  await runGenerator("first deterministic pass");
  if (issues.length > 0) {
    return;
  }
  const firstRuntimeFiles = await validateRuntimeDataTree("generated/data");
  const firstSnapshot = await snapshotDeterministicContracts(firstRuntimeFiles);

  validateNoRuntimeManifestFetch(
    await collectTextFiles("src", [".ts", ".tsx", ".js", ".jsx", ".mjs"]),
    "browser source",
  );
  await validateSchemasAndSize();
  await validateSensitiveRuntimeData(firstRuntimeFiles);

  await runGenerator("second deterministic pass");
  if (issues.length > 0) {
    return;
  }
  const secondRuntimeFiles = await validateRuntimeDataTree("generated/data");
  const secondSnapshot = await snapshotDeterministicContracts(secondRuntimeFiles);
  compareSnapshots(firstSnapshot, secondSnapshot);
}

async function validateDistOutput(): Promise<void> {
  if (!existsSync(resolve(projectRoot, "dist"))) {
    issues.push({ file: "dist", message: "Expected dist output to exist before dist validation" });
    return;
  }
  const distDataFiles = await validateRuntimeDataTree("dist/data");
  const files = (await listFiles(resolve(projectRoot, "dist"), [".html", ".css", ".js", ".json"])).filter((file) => {
    const outputPath = relative(projectRoot, file);
    return outputPath === "dist/index.html" || outputPath.startsWith("dist/assets/") || outputPath.startsWith("dist/data/");
  });
  const bundleFiles = files.filter((file) => {
    const extension = extname(file);
    return extension === ".html" || extension === ".css" || extension === ".js";
  });
  validateNoRuntimeManifestFetch(await readFiles(bundleFiles), "dist runtime bundle");
  await validateSensitiveRuntimeData([...bundleFiles.map((file) => relative(projectRoot, file)), ...distDataFiles]);
}

async function validateSchemasAndSize(): Promise<void> {
  const recommendationFiles = await listRecommendationFiles();
  const [compactText, itemColorsText, pokemonText, recommendationTexts] = await Promise.all([
    readFile(compactItemsPath, "utf8"),
    readFile(itemColorsPath, "utf8"),
    readFile(pokemonIndexPath, "utf8"),
    readFilesAsText(recommendationFiles),
  ]);

  const compactGzipBytes = gzipSync(compactText).length;
  if (compactGzipBytes >= compactGzipLimit) {
    issues.push({
      file: compactItemsPath,
      message: `Expected gzip size below ${compactGzipLimit} bytes, got ${compactGzipBytes}`,
    });
  } else {
    console.log(`Validated ${compactItemsPath} gzip ${compactGzipBytes}/${compactGzipLimit} bytes.`);
  }

  const compactItems = parseJson(compactText, compactItemsPath);
  const itemColors = parseJson(itemColorsText, itemColorsPath);
  const pokemonIndex = parseJson(pokemonText, pokemonIndexPath);
  const recommendations = recommendationTexts.map(([file, text]) => [file, parseJson(text, file)] as const);

  if (compactItems !== null) {
    addSchemaIssues(compactItemsPath, validateCompactItemsData(compactItems));
  }
  if (itemColors !== null) {
    addSchemaIssues(itemColorsPath, validateItemColorsData(itemColors));
  }
  if (pokemonIndex !== null) {
    addSchemaIssues(pokemonIndexPath, validatePokemonIndexData(pokemonIndex));
  }
  recommendations.forEach(([file, recommendation]) => {
    if (recommendation === null) {
      return;
    }
    addSchemaIssues(file, validateRecommendationsData(recommendation));
    const gzipBytes = gzipSync(JSON.stringify(recommendation, null, 2)).length;
    if (gzipBytes >= recommendationGzipLimit) {
      issues.push({
        file,
        message: `Expected gzip size below ${recommendationGzipLimit} bytes, got ${gzipBytes}`,
      });
    }
  });

  validateRecommendationCoverage(pokemonIndex, recommendations);
}

function validateNoRuntimeManifestFetch(sourceFiles: Map<string, string>, label: string): void {
  const forbiddenPatterns: RegExp[] = [
    /docs\/pokopia_image_sources\/item_portraits\/manifest\.csv/,
    /item_portraits\/manifest\.csv/,
  ];
  sourceFiles.forEach((text, file) => {
    if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
      issues.push({
        file: relative(projectRoot, file),
        message: `${label} must not reference full item manifest runtime path`,
      });
    }
  });
}

async function validateSensitiveRuntimeData(files: string[]): Promise<void> {
  const home = process.env.HOME;
  const patterns: Array<[RegExp, string]> = [
    [/\/Users\//, "contains macOS user path"],
    [/\/home\/[^/\s]+/, "contains Linux user path"],
    [/[A-Za-z]:\\Users\\[^\\\s]+/, "contains Windows user path"],
    [/sk-[A-Za-z0-9_-]{20,}/, "contains API-key-like token"],
    [/ghp_[A-Za-z0-9_]{30,}/, "contains GitHub token-like value"],
    [/AKIA[0-9A-Z]{16}/, "contains AWS access-key-like value"],
    [/\b(api[_-]?key|secret|password|private[_-]?key)\b/i, "contains secret-like field"],
    [/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, "contains timestamp-like runtime value"],
  ];

  await Promise.all(
    files.map(async (file) => {
      let text: string;
      try {
        text = await readFile(file, "utf8");
      } catch (error) {
        issues.push({ file, message: `Unable to read runtime data for sensitive scan: ${error instanceof Error ? error.message : String(error)}` });
        return;
      }
      if (text.includes(projectRoot) || (home && text.includes(home))) {
        issues.push({ file, message: "contains local absolute project/home path" });
      }
      patterns.forEach(([pattern, message]) => {
        if (pattern.test(text)) {
          issues.push({ file, message });
        }
      });
    }),
  );
}

async function runGenerator(label: string): Promise<void> {
  const result = spawnSync(process.execPath, [".tmp/data-scripts/scripts/generate-data.js"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    issues.push({
      file: "scripts/generate-data.ts",
      message: `Data generation failed during ${label}: ${(result.stderr || result.stdout).trim()}`,
    });
  }
}

async function listRecommendationFiles(): Promise<string[]> {
  const absoluteRecommendationDir = resolve(projectRoot, recommendationsDir);
  if (!existsSync(absoluteRecommendationDir)) {
    issues.push({ file: recommendationsDir, message: "Expected recommendation data directory to exist" });
    return [];
  }

  return (await listFiles(absoluteRecommendationDir, [".json"]))
    .map((file) => relative(projectRoot, file))
    .sort((left, right) => left.localeCompare(right, "en"));
}

async function readFilesAsText(files: string[]): Promise<Array<[string, string]>> {
  return Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")] as const));
}

function validateRecommendationCoverage(
  pokemonIndex: unknown | null,
  recommendations: Array<readonly [string, unknown | null]>,
): void {
  if (!isRecord(pokemonIndex) || !Array.isArray(pokemonIndex.pokemon)) {
    return;
  }

  const expectedSlugs = new Set(
    pokemonIndex.pokemon
      .filter(isRecord)
      .map((pokemon) => pokemon.slug)
      .filter((slug): slug is string => typeof slug === "string"),
  );
  const actualSlugs = new Set<string>();

  recommendations.forEach(([file, recommendation]) => {
    if (!isRecord(recommendation) || typeof recommendation.pokemonSlug !== "string") {
      return;
    }
    const expectedPath = `${recommendationsDir}/${recommendation.pokemonSlug}.json`;
    if (file !== expectedPath) {
      issues.push({ file, message: `Expected file path ${expectedPath} to match pokemonSlug` });
    }
    actualSlugs.add(recommendation.pokemonSlug);
  });

  if (actualSlugs.size !== expectedSlugs.size) {
    issues.push({
      file: recommendationsDir,
      message: `Expected ${expectedSlugs.size} Pokemon recommendation files, got ${actualSlugs.size}`,
    });
  }
  expectedSlugs.forEach((slug) => {
    if (!actualSlugs.has(slug)) {
      issues.push({ file: `${recommendationsDir}/${slug}.json`, message: "Missing recommendation file for Pokemon" });
    }
  });
}

async function validateRuntimeDataTree(root: string): Promise<string[]> {
  const absoluteRoot = resolve(projectRoot, root);
  if (!existsSync(absoluteRoot)) {
    issues.push({ file: root, message: "Expected runtime data directory to exist" });
    return [];
  }

  const [entries, allowlist] = await Promise.all([listTreeEntries(absoluteRoot), expectedRuntimeDataAllowlist(root)]);
  const seenFiles = new Set<string>();
  const seenDirectories = new Set<string>();

  entries.forEach((entry) => {
    const path = `${root}/${entry.path}`;
    if (entry.isDirectory) {
      seenDirectories.add(entry.path);
      if (!allowlist.directories.has(entry.path)) {
        issues.push({ file: path, message: "Unexpected runtime data directory would be copied or served" });
      }
      return;
    }

    seenFiles.add(entry.path);
    if (!allowlist.files.has(entry.path)) {
      issues.push({ file: path, message: "Unexpected runtime data file would be copied or served" });
    }
  });

  allowlist.directories.forEach((directory) => {
    if (!seenDirectories.has(directory)) {
      issues.push({ file: `${root}/${directory}`, message: "Missing expected runtime data directory" });
    }
  });
  allowlist.files.forEach((file) => {
    if (!seenFiles.has(file)) {
      issues.push({ file: `${root}/${file}`, message: "Missing expected runtime data file" });
    }
  });

  return Array.from(seenFiles, (file) => `${root}/${file}`).sort((left, right) => left.localeCompare(right, "en"));
}

async function expectedRuntimeDataAllowlist(root: string): Promise<{ directories: Set<string>; files: Set<string> }> {
  const files = new Set(["compact-items.json", "item-colors.json", "pokemon-index.json"]);
  const directories = new Set(["recommendations"]);
  let pokemonIndexText: string;

  try {
    pokemonIndexText = await readFile(`${root}/pokemon-index.json`, "utf8");
  } catch (error) {
    issues.push({ file: `${root}/pokemon-index.json`, message: `Unable to read Pokemon index for runtime allowlist: ${error instanceof Error ? error.message : String(error)}` });
    return { directories, files };
  }

  const pokemonIndex = parseJson(pokemonIndexText, `${root}/pokemon-index.json`);
  if (!isRecord(pokemonIndex) || !Array.isArray(pokemonIndex.pokemon)) {
    return { directories, files };
  }

  pokemonIndex.pokemon.filter(isRecord).forEach((pokemon) => {
    if (typeof pokemon.slug === "string") {
      files.add(`recommendations/${pokemon.slug}.json`);
    }
  });

  return { directories, files };
}

async function snapshotDeterministicContracts(runtimeFiles: string[]): Promise<Map<string, string>> {
  const deterministicContractPaths = [...runtimeFiles, "src/data/schemas.ts"];
  const entries = await Promise.all(
    deterministicContractPaths.map(async (file) => {
      const text = await readFile(file, "utf8");
      return [file, createHash("sha256").update(text).digest("hex")] as const;
    }),
  );
  return new Map(entries);
}

function compareSnapshots(first: Map<string, string>, second: Map<string, string>): void {
  const files = new Set([...first.keys(), ...second.keys()]);
  files.forEach((file) => {
    if (first.get(file) !== second.get(file)) {
      issues.push({ file, message: "Deterministic data/schema contract changed across consecutive runs with the same inputs" });
    }
  });
}

function addSchemaIssues(file: string, schemaIssues: SchemaIssue[]): void {
  schemaIssues.forEach((issue) => {
    issues.push({ file, message: `${issue.path}: ${issue.message}` });
  });
}

function parseJson(text: string, file: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    issues.push({ file, message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` });
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function collectTextFiles(root: string, extensions: string[]): Promise<Map<string, string>> {
  const files = await listFiles(resolve(projectRoot, root), extensions);
  return readFiles(files);
}

async function readFiles(files: string[]): Promise<Map<string, string>> {
  const contents = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")] as const));
  return new Map(contents);
}

type TreeEntry = {
  path: string;
  isDirectory: boolean;
};

async function listTreeEntries(root: string, prefix = ""): Promise<TreeEntry[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return [{ path: entryPath, isDirectory: true }, ...(await listTreeEntries(path, entryPath))];
      }
      return [{ path: entryPath, isDirectory: false }];
    }),
  );
  return children.flat();
}

async function listFiles(root: string, extensions: string[]): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return listFiles(path, extensions);
      }
      return extensions.includes(extname(entry.name)) ? [path] : [];
    }),
  );
  return children.flat();
}
