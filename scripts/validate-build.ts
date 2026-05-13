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
  type SchemaIssue,
} from "../src/data/schemas.js";

type ValidationIssue = {
  file: string;
  message: string;
};

const compactItemsPath = "generated/data/compact-items.json";
const itemColorsPath = "generated/data/item-colors.json";
const pokemonIndexPath = "generated/data/pokemon-index.json";
const runtimeDataPaths = [compactItemsPath, itemColorsPath, pokemonIndexPath];
const deterministicContractPaths = [...runtimeDataPaths, "src/data/schemas.ts"];
const compactGzipLimit = 50 * 1024;
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
  const firstSnapshot = await snapshotDeterministicContracts();

  validateNoRuntimeManifestFetch(
    await collectTextFiles("src", [".ts", ".tsx", ".js", ".jsx", ".mjs"]),
    "browser source",
  );
  await validateSchemasAndSize();
  await validateSensitiveRuntimeData(runtimeDataPaths);

  await runGenerator("second deterministic pass");
  if (issues.length > 0) {
    return;
  }
  const secondSnapshot = await snapshotDeterministicContracts();
  compareSnapshots(firstSnapshot, secondSnapshot);
}

async function validateDistOutput(): Promise<void> {
  if (!existsSync(resolve(projectRoot, "dist"))) {
    issues.push({ file: "dist", message: "Expected dist output to exist before dist validation" });
    return;
  }
  const files = (await listFiles(resolve(projectRoot, "dist"), [".html", ".css", ".js", ".json"])).filter((file) => {
    const outputPath = relative(projectRoot, file);
    return outputPath === "dist/index.html" || outputPath.startsWith("dist/assets/") || outputPath.startsWith("dist/data/");
  });
  const bundleFiles = files.filter((file) => {
    const extension = extname(file);
    return extension === ".html" || extension === ".css" || extension === ".js";
  });
  validateNoRuntimeManifestFetch(await readFiles(bundleFiles), "dist runtime bundle");
  await validateSensitiveRuntimeData(files.map((file) => relative(projectRoot, file)));
}

async function validateSchemasAndSize(): Promise<void> {
  const [compactText, itemColorsText, pokemonText] = await Promise.all([
    readFile(compactItemsPath, "utf8"),
    readFile(itemColorsPath, "utf8"),
    readFile(pokemonIndexPath, "utf8"),
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

  if (compactItems !== null) {
    addSchemaIssues(compactItemsPath, validateCompactItemsData(compactItems));
  }
  if (itemColors !== null) {
    addSchemaIssues(itemColorsPath, validateItemColorsData(itemColors));
  }
  if (pokemonIndex !== null) {
    addSchemaIssues(pokemonIndexPath, validatePokemonIndexData(pokemonIndex));
  }
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
      const text = await readFile(file, "utf8");
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

async function snapshotDeterministicContracts(): Promise<Map<string, string>> {
  const entries = await Promise.all(
    deterministicContractPaths.map(async (file) => {
      const text = await readFile(file, "utf8");
      return [file, createHash("sha256").update(text).digest("hex")] as const;
    }),
  );
  return new Map(entries);
}

function compareSnapshots(first: Map<string, string>, second: Map<string, string>): void {
  deterministicContractPaths.forEach((file) => {
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

async function collectTextFiles(root: string, extensions: string[]): Promise<Map<string, string>> {
  const files = await listFiles(resolve(projectRoot, root), extensions);
  return readFiles(files);
}

async function readFiles(files: string[]): Promise<Map<string, string>> {
  const contents = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")] as const));
  return new Map(contents);
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
