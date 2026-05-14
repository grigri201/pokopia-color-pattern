import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import {
  validateCompactItemsData,
  validateItemColorsData,
  validatePokemonIndexData,
  validateRecommendationsData,
  validateRuntimeAssetManifestData,
  type SchemaIssue,
} from "../src/data/schemas.js";

type ValidationIssue = {
  file: string;
  message: string;
};

type StaticPokemonEntry = {
  slug: string;
  sequence: string;
  name: string;
  zhName: string | null;
  imagePath: string;
  primaryColor: string;
};

type StaticItemEntry = {
  slug: string;
  name: string;
  nameZh: string | null;
  category: string | null;
  imagePath: string;
  recommendation: {
    isDyeable: boolean | null;
    dyeColorVariants: string[];
    itemPrimaryColor: string | null;
  };
};

type DistRecommendationReadResult = {
  data: unknown | null;
  missing: boolean;
};

type ExpectedSsgPageRecord = {
  pokemonSlug: string;
  outputPath: string;
  recommendationCount: number;
  fallbackType: "empty_recommendations" | "missing_recommendation_file" | null;
};

type ExpectedSsgFallbackRecord = {
  pokemonSlug: string;
  fallbackType: "empty_recommendations" | "missing_recommendation_file";
  recommendationCount: number;
};

type RecommendationSummaryText = {
  status: "ready" | "empty" | "missing";
  text: string;
};

type StaticMetadataAccumulator = {
  titles: Map<string, string[]>;
  descriptions: Map<string, string[]>;
};

const compactItemsPath = "generated/data/compact-items.json";
const itemColorsPath = "generated/data/item-colors.json";
const pokemonIndexPath = "generated/data/pokemon-index.json";
const recommendationsDir = "generated/data/recommendations";
const recommendationDiagnosticsPath = "generated/reports/recommendation-diagnostics.json";
const ssgGenerationSummaryPath = "generated/reports/ssg-generation-summary.json";
const runtimeAssetSourcesPath = "generated/reports/runtime-asset-sources.json";
const runtimeAssetManifestPath = "dist/assets/runtime/asset-manifest.json";
const runtimeDataPaths = [compactItemsPath, itemColorsPath, pokemonIndexPath];
const compactGzipLimit = 50 * 1024;
const recommendationGzipLimit = 5 * 1024;
const recommendationRawTotalLimit = 12 * 1024 * 1024;
const recommendationGzipTotalLimit = 800 * 1024;
const distLogicalByteLimit = 40 * 1024 * 1024;
const runtimeImageTotalLimit = 15 * 1024 * 1024;
const runtimePokemonImageLimit = 64 * 1024;
const runtimeItemImageLimit = 32 * 1024;
const runtimePokemonMaxEdge = 420;
const runtimeItemMaxEdge = 240;
const expectedPokemonCount = 311;
const projectRoot = process.cwd();
const siteOrigin = normalizeSiteOrigin(process.env.POKOPIA_SITE_URL ?? "https://pokopia-color-pattern.local");
const distOnly = process.argv.includes("--dist");
const recommendationsOnly = process.argv.includes("--recommendations");
const issues: ValidationIssue[] = [];

if (distOnly) {
  await validateDistOutput();
} else if (recommendationsOnly) {
  await validateRecommendationDataBudget();
} else {
  await validateGeneratedDataGate();
}

if (issues.length > 0) {
  console.error(distOnly ? "Build output validation failed" : recommendationsOnly ? "Recommendation validation failed" : "Build validation failed");
  issues.forEach((issue) => console.error(`- ${issue.file}: ${issue.message}`));
  process.exitCode = 1;
} else {
  console.log(
    distOnly
      ? "Validated dist output for private data and secrets."
      : recommendationsOnly
        ? "Validated recommendation schemas and size budgets."
        : "Validated compact data size, determinism, schemas, and runtime boundaries.",
  );
}

async function validateGeneratedDataGate(): Promise<void> {
  await runGenerator("first deterministic pass");
  if (issues.length > 0) {
    return;
  }
  const firstRuntimeFiles = await validateRuntimeDataTree("generated/data");
  await validateDiagnosticsReportFile();
  await validateRuntimeAssetSourcesReport();
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
  await validateDiagnosticsReportFile();
  await validateRuntimeAssetSourcesReport();
  const secondSnapshot = await snapshotDeterministicContracts(secondRuntimeFiles);
  compareSnapshots(firstSnapshot, secondSnapshot);
}

async function validateRecommendationDataBudget(): Promise<void> {
  await validateSchemasAndSize();
}

async function validateDistOutput(): Promise<void> {
  if (!existsSync(resolve(projectRoot, "dist"))) {
    issues.push({ file: "dist", message: "Expected dist output to exist before dist validation" });
    return;
  }
  const distEntries = await listTreeEntries(resolve(projectRoot, "dist"));
  validateDistLogicalSize(distEntries);
  validateNoForbiddenDistOutput(distEntries);
  const ssgReport = await readSsgGenerationSummary();
  const distDataFiles = await validateRuntimeDataTree("dist/data", missingRecommendationFilesFromReport(ssgReport));
  await validateRecommendationBundleSizeBudget("dist/data/recommendations");
  const runtimeAssetPaths = await validateRuntimeAssetManifest();
  await validateStaticPokemonPages(ssgReport);
  const files = (await listFiles(resolve(projectRoot, "dist"), [".html", ".css", ".js", ".json", ".map"])).filter((file) => {
    const outputPath = relative(projectRoot, file);
    return (
      outputPath === "dist/index.html" ||
      outputPath.startsWith("dist/assets/") ||
      outputPath.startsWith("dist/data/") ||
      outputPath.startsWith("dist/pokemon/")
    );
  });
  const referenceFiles = files.filter((file) => relative(projectRoot, file) !== runtimeAssetManifestPath);
  const bundleFiles = referenceFiles.filter((file) => {
    const extension = extname(file);
    return extension === ".html" || extension === ".css" || extension === ".js";
  });
  validateNoRuntimeManifestFetch(await readFiles(bundleFiles), "dist runtime bundle");
  const referenceFileTexts = await readFiles(referenceFiles);
  validateNoDocsSourceReferences(referenceFileTexts, "dist runtime output");
  const referencedRuntimeAssetPaths = validateRuntimeAssetReferences(referenceFileTexts, runtimeAssetPaths);
  validateManifestRuntimeAssetsAreReferenced(runtimeAssetPaths, referencedRuntimeAssetPaths);
  await validateSensitiveTextFiles(files.map((file) => relative(projectRoot, file)), "dist deployable text output");
  await validateSensitiveRuntimeData([...bundleFiles.map((file) => relative(projectRoot, file)), ...distDataFiles]);
}

async function validateStaticPokemonPages(ssgReport: unknown | null): Promise<void> {
  const pokemonIndexFile = "dist/data/pokemon-index.json";
  let pokemonIndexText: string;
  try {
    pokemonIndexText = await readFile(pokemonIndexFile, "utf8");
  } catch (error) {
    issues.push({ file: pokemonIndexFile, message: `Unable to read Pokemon index for static page validation: ${error instanceof Error ? error.message : String(error)}` });
    return;
  }

  const pokemonIndex = parseJson(pokemonIndexText, pokemonIndexFile);
  if (!isRecord(pokemonIndex) || !Array.isArray(pokemonIndex.pokemon)) {
    issues.push({ file: pokemonIndexFile, message: "Expected pokemon array for static page validation" });
    return;
  }

  const pokemonEntries = pokemonIndex.pokemon
    .map((pokemon, index) => toStaticPokemonEntry(pokemon, index, pokemonIndexFile))
    .filter((pokemon): pokemon is StaticPokemonEntry => pokemon !== null)
    .sort((left, right) => left.slug.localeCompare(right.slug, "en"));
  const expectedSlugs = pokemonEntries.map((pokemon) => pokemon.slug);
  const pokemonBySlug = new Map(pokemonEntries.map((pokemon) => [pokemon.slug, pokemon]));
  const itemBySlug = await readStaticItemEntries();

  if (expectedSlugs.length !== expectedPokemonCount) {
    issues.push({ file: pokemonIndexFile, message: `Expected ${expectedPokemonCount} Pokemon slugs for static pages, got ${expectedSlugs.length}` });
  }

  const staticRoot = resolve(projectRoot, "dist/pokemon");
  if (!existsSync(staticRoot)) {
    issues.push({ file: "dist/pokemon", message: "Expected static Pokemon page directory to exist" });
    return;
  }

  const actualFiles = (await listFiles(staticRoot, [".html"]))
    .map((file) => relative(projectRoot, file))
    .sort((left, right) => left.localeCompare(right, "en"));
  const actualFileSet = new Set(actualFiles);
  const expectedFileSet = new Set(expectedSlugs.map((slug) => `dist/pokemon/${slug}/index.html`));

  if (actualFiles.length !== expectedSlugs.length) {
    issues.push({ file: "dist/pokemon", message: `Expected ${expectedSlugs.length} static Pokemon HTML files, got ${actualFiles.length}` });
  }

  expectedFileSet.forEach((file) => {
    if (!actualFileSet.has(file)) {
      issues.push({ file, message: "Missing static Pokemon HTML page" });
    }
  });
  actualFiles.forEach((file) => {
    if (!expectedFileSet.has(file)) {
      issues.push({ file, message: "Unexpected static Pokemon HTML page" });
    }
  });

  const metadataAccumulator: StaticMetadataAccumulator = { titles: new Map(), descriptions: new Map() };
  const expectedPages: ExpectedSsgPageRecord[] = [];
  const expectedFallbacks: ExpectedSsgFallbackRecord[] = [];
  await Promise.all(
    expectedSlugs.map(async (slug) => {
      const file = `dist/pokemon/${slug}/index.html`;
      const pokemon = pokemonBySlug.get(slug);
      if (!pokemon) {
        issues.push({ file, message: `Missing Pokemon metadata for slug ${slug}` });
        return;
      }
      let text: string;
      try {
        text = await readFile(file, "utf8");
      } catch (error) {
        issues.push({ file, message: `Unable to read static Pokemon page: ${error instanceof Error ? error.message : String(error)}` });
        return;
      }
      const recommendationResult = await readDistRecommendations(slug);
      const summary = expectedRecommendationSummary(pokemon, recommendationResult, itemBySlug);
      validateStaticPokemonPage(file, pokemon, text, recommendationResult, summary, metadataAccumulator, itemBySlug);
      const fallbackType = expectedFallbackType(recommendationResult);
      expectedPages.push({
        pokemonSlug: slug,
        outputPath: file,
        recommendationCount: recommendationCount(recommendationResult),
        fallbackType,
      });
      if (fallbackType) {
        expectedFallbacks.push({
          pokemonSlug: slug,
          fallbackType,
          recommendationCount: 0,
        });
      }
    }),
  );
  validateUniqueStaticMetadata(metadataAccumulator);
  validateSsgGenerationSummary(ssgReport, expectedSlugs, expectedPages, expectedFallbacks);
}

function validateDistLogicalSize(entries: TreeEntry[]): void {
  const logicalBytes = entries.reduce((sum, entry) => sum + (entry.isDirectory ? 0 : entry.sizeBytes), 0);
  if (logicalBytes >= distLogicalByteLimit) {
    issues.push({ file: "dist", message: `dist logical size exceeds ${distLogicalByteLimit} byte budget: ${logicalBytes}` });
  } else {
    console.log(`Validated dist logical size ${logicalBytes}/${distLogicalByteLimit} bytes.`);
  }
}

function validateNoForbiddenDistOutput(entries: TreeEntry[]): void {
  entries.forEach((entry) => {
    const outputPath = `dist/${entry.path}`;
    const fileName = entry.path.split("/").at(-1) ?? entry.path;
    if (outputPath.startsWith("dist/docs/pokopia_image_sources")) {
      issues.push({ file: outputPath, message: "Raw Pokopia source directory must not be present in dist" });
    }
    if (entry.path.endsWith(".DS_Store")) {
      issues.push({ file: outputPath, message: ".DS_Store must not be present in dist" });
    }
    if (entry.path.endsWith(".csv")) {
      issues.push({ file: outputPath, message: "Raw source CSV must not be present in dist" });
    }
    if (
      fileName === "item-colors.json" ||
      fileName === "recommendation-diagnostics.json" ||
      fileName === "runtime-asset-sources.json" ||
      fileName === "ssg-generation-summary.json" ||
      fileName === "manifest.csv" ||
      fileName.startsWith("pokopiadex_") ||
      fileName === "decorative_item_images.csv" ||
      fileName === "item_furniture_images.csv"
    ) {
      issues.push({ file: outputPath, message: "Build-only source or diagnostics file must not be served as runtime output" });
    }
  });
}

async function validateRuntimeAssetManifest(): Promise<Set<string>> {
  let text: string;
  try {
    text = await readFile(runtimeAssetManifestPath, "utf8");
  } catch (error) {
    issues.push({ file: runtimeAssetManifestPath, message: `Unable to read runtime asset manifest: ${error instanceof Error ? error.message : String(error)}` });
    return new Set();
  }

  const manifest = parseJson(text, runtimeAssetManifestPath);
  if (manifest !== null) {
    addSchemaIssues(runtimeAssetManifestPath, validateRuntimeAssetManifestData(manifest));
  }
  if (!isRecord(manifest) || !Array.isArray(manifest.assets)) {
    return new Set();
  }

  const seenRuntimePaths = new Set<string>();
  let totalRuntimeImageBytes = 0;
  for (const [index, asset] of manifest.assets.entries()) {
    if (!isRecord(asset)) {
      continue;
    }
    const runtimePath = asset.runtimePath;
    const contentType = asset.contentType;
    const sourceCategory = asset.sourceCategory;
    const width = asset.width;
    const height = asset.height;
    const byteSize = asset.byteSize;
    if (typeof runtimePath !== "string") {
      continue;
    }
    if (!runtimePath.startsWith("/assets/runtime/")) {
      issues.push({ file: runtimeAssetManifestPath, message: `Asset ${index} must use /assets/runtime/** path` });
      continue;
    }
    if (seenRuntimePaths.has(runtimePath)) {
      issues.push({ file: runtimeAssetManifestPath, message: `Duplicate runtime asset path ${runtimePath}` });
    }
    seenRuntimePaths.add(runtimePath);
    if (typeof contentType === "string") {
      const expectedExtension = runtimeExtensionForContentType(contentType);
      if (expectedExtension === null) {
        issues.push({ file: runtimeAssetManifestPath, message: `Unsupported contentType for ${runtimePath}: ${contentType}` });
      } else if (!runtimePath.endsWith(expectedExtension)) {
        issues.push({ file: runtimeAssetManifestPath, message: `Runtime asset extension must match ${contentType}: ${runtimePath}` });
      }
    }
    if (contentType !== "image/webp" || !runtimePath.endsWith(".webp")) {
      issues.push({ file: runtimeAssetManifestPath, message: `Runtime asset must be optimized WebP: ${runtimePath}` });
    }
    const filePath = resolve(projectRoot, "dist", runtimePath.replace(/^\//, ""));
    if (!existsSync(filePath)) {
      issues.push({ file: runtimeAssetManifestPath, message: `Runtime asset file is missing: ${runtimePath}` });
      continue;
    }
    let actualStat: Awaited<ReturnType<typeof stat>>;
    let metadata: sharp.Metadata;
    try {
      [actualStat, metadata] = await Promise.all([stat(filePath), sharp(filePath).metadata()]);
    } catch (error) {
      issues.push({ file: runtimeAssetManifestPath, message: `Unable to inspect runtime asset ${runtimePath}: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }
    totalRuntimeImageBytes += actualStat.size;
    if (metadata.format !== "webp") {
      issues.push({ file: runtimeAssetManifestPath, message: `Runtime asset file must be WebP: ${runtimePath}` });
    }
    const byteLimit = sourceCategory === "pokemon" ? runtimePokemonImageLimit : sourceCategory === "item" ? runtimeItemImageLimit : null;
    if (byteLimit !== null && actualStat.size >= byteLimit) {
      issues.push({ file: runtimeAssetManifestPath, message: `${runtimePath} exceeds ${byteLimit} byte budget: ${actualStat.size}` });
    }
    if (typeof byteSize === "number" && actualStat.size !== byteSize) {
      issues.push({ file: runtimeAssetManifestPath, message: `${runtimePath} byteSize metadata ${byteSize} does not match actual file size ${actualStat.size}` });
    }
    const actualWidth = metadata.width ?? null;
    const actualHeight = metadata.height ?? null;
    if (typeof actualWidth !== "number" || typeof actualHeight !== "number") {
      issues.push({ file: runtimeAssetManifestPath, message: `Unable to read runtime asset dimensions: ${runtimePath}` });
    } else {
      const edgeLimit = sourceCategory === "pokemon" ? runtimePokemonMaxEdge : sourceCategory === "item" ? runtimeItemMaxEdge : null;
      if (edgeLimit !== null && Math.max(actualWidth, actualHeight) > edgeLimit) {
        issues.push({ file: runtimeAssetManifestPath, message: `${runtimePath} exceeds ${edgeLimit}px edge budget: ${actualWidth}x${actualHeight}` });
      }
    }
    if (typeof width === "number" && actualWidth !== width) {
      issues.push({ file: runtimeAssetManifestPath, message: `${runtimePath} width metadata ${width} does not match actual width ${String(actualWidth)}` });
    }
    if (typeof height === "number" && actualHeight !== height) {
      issues.push({ file: runtimeAssetManifestPath, message: `${runtimePath} height metadata ${height} does not match actual height ${String(actualHeight)}` });
    }
  }

  const actualRuntimeFiles = await listFiles(resolve(projectRoot, "dist/assets/runtime"), [".webp", ".png", ".jpg", ".jpeg", ".gif"]);
  actualRuntimeFiles.forEach((file) => {
    const runtimePath = `/${relative(resolve(projectRoot, "dist"), file)}`;
    if (!seenRuntimePaths.has(runtimePath)) {
      issues.push({ file: relative(projectRoot, file), message: "Runtime asset file is not declared in asset-manifest.json" });
    }
  });
  const summary = manifest.summary;
  if (isRecord(summary) && typeof summary.totalBytes === "number" && summary.totalBytes !== totalRuntimeImageBytes) {
    issues.push({
      file: runtimeAssetManifestPath,
      message: `Runtime image total metadata ${summary.totalBytes} does not match actual file total ${totalRuntimeImageBytes}`,
    });
  }
  if (totalRuntimeImageBytes >= runtimeImageTotalLimit) {
    issues.push({
      file: runtimeAssetManifestPath,
      message: `Runtime image total exceeds ${runtimeImageTotalLimit} byte budget: ${totalRuntimeImageBytes}`,
    });
  } else {
    console.log(`Validated runtime image total ${totalRuntimeImageBytes}/${runtimeImageTotalLimit} bytes.`);
  }
  return seenRuntimePaths;
}

function runtimeExtensionForContentType(contentType: string): string | null {
  switch (contentType) {
    case "image/webp":
      return ".webp";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    default:
      return null;
  }
}

function toStaticPokemonEntry(value: unknown, index: number, file: string): StaticPokemonEntry | null {
  if (!isRecord(value)) {
    issues.push({ file, message: `Expected pokemon[${index}] object for static page validation` });
    return null;
  }
  const slug = value.slug;
  const sequence = value.sequence;
  const name = value.name;
  const zhName = value.zhName;
  const imagePath = value.imagePath;
  const primaryColor = value.primaryColor;
  if (
    typeof slug !== "string" ||
    typeof sequence !== "string" ||
    typeof name !== "string" ||
    (zhName !== null && typeof zhName !== "string") ||
    typeof imagePath !== "string" ||
    typeof primaryColor !== "string"
  ) {
    issues.push({ file, message: `Expected pokemon[${index}] to include slug, sequence, name, zhName, imagePath, and primaryColor` });
    return null;
  }
  if (!imagePath.startsWith("/assets/runtime/pokemon/")) {
    issues.push({ file, message: `Expected pokemon[${index}].imagePath to use /assets/runtime/pokemon/**` });
  }
  return { slug, sequence, name, zhName, imagePath, primaryColor };
}

async function readStaticItemEntries(): Promise<Map<string, StaticItemEntry>> {
  const file = "dist/data/compact-items.json";
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    issues.push({ file, message: `Unable to read compact items for recommendation lookup: ${error instanceof Error ? error.message : String(error)}` });
    return new Map();
  }
  const compactItems = parseJson(text, file);
  if (!isRecord(compactItems) || !Array.isArray(compactItems.items)) {
    issues.push({ file, message: "Expected compact item array for recommendation lookup" });
    return new Map();
  }
  const entries = compactItems.items
    .map((item, index) => toStaticItemEntry(item, index, file))
    .filter((item): item is StaticItemEntry => item !== null);
  return new Map(entries.map((item) => [item.slug, item]));
}

function toStaticItemEntry(value: unknown, index: number, file: string): StaticItemEntry | null {
  if (!isRecord(value)) {
    issues.push({ file, message: `Expected items[${index}] object for recommendation lookup` });
    return null;
  }
  const recommendation = value.recommendation;
  if (
    typeof value.slug !== "string" ||
    typeof value.name !== "string" ||
    !("nameZh" in value) ||
    typeof value.imagePath !== "string" ||
    !isRecord(recommendation) ||
    !Array.isArray(recommendation.dyeColorVariants)
  ) {
    issues.push({ file, message: `Invalid compact item lookup fields at items[${index}]` });
    return null;
  }
  return {
    slug: value.slug,
    name: value.name,
    nameZh: typeof value.nameZh === "string" ? value.nameZh : null,
    category: typeof value.category === "string" ? value.category : null,
    imagePath: value.imagePath,
    recommendation: {
      isDyeable: typeof recommendation.isDyeable === "boolean" ? recommendation.isDyeable : null,
      dyeColorVariants: recommendation.dyeColorVariants.filter((color): color is string => typeof color === "string"),
      itemPrimaryColor: typeof recommendation.itemPrimaryColor === "string" ? recommendation.itemPrimaryColor : null,
    },
  };
}

async function readDistRecommendations(slug: string): Promise<DistRecommendationReadResult> {
  const file = `dist/data/recommendations/${slug}.json`;
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return { data: null, missing: true };
    }
    issues.push({ file, message: `Unable to read recommendation data for static page validation: ${error instanceof Error ? error.message : String(error)}` });
    return { data: null, missing: false };
  }
  return { data: parseJson(text, file), missing: false };
}

function validateStaticPokemonPage(
  file: string,
  pokemon: StaticPokemonEntry,
  text: string,
  recommendationResult: DistRecommendationReadResult,
  summary: RecommendationSummaryText,
  metadataAccumulator: StaticMetadataAccumulator,
  itemBySlug: Map<string, StaticItemEntry>,
): void {
  if (!text.includes('id="staticPage"')) {
    issues.push({ file, message: "Static Pokemon page is missing #staticPage no-JS content" });
  }
  if (!text.includes(`data-static-pokemon="${pokemon.slug}"`)) {
    issues.push({ file, message: `Static Pokemon page does not identify slug ${pokemon.slug}` });
  }
  if (!text.includes("--field-ink:") || !text.includes("--static-muted:")) {
    issues.push({ file, message: "Static Pokemon page must include readable text color variables" });
  }
  validateStaticMetadata(file, pokemon, text, summary, metadataAccumulator);
  validateStaticRecommendationSummary(file, pokemon, text, recommendationResult, summary, itemBySlug);
  if (!text.includes("主色与色板") || !text.includes("推荐摘要") || !/<img\b[^>]*class="static-portrait"/.test(text)) {
    issues.push({ file, message: "Static Pokemon page is missing required no-JS readable content" });
  }
  validateRootAbsoluteHtmlReferences(file, text);
  validateStaticRuntimeImageReferences(file, text);
}

function validateStaticMetadata(
  file: string,
  pokemon: StaticPokemonEntry,
  text: string,
  summary: RecommendationSummaryText,
  accumulator: StaticMetadataAccumulator,
): void {
  const title = matchFirst(text, /<title>([^<]+)<\/title>/);
  const description = matchFirst(text, /<meta name="description" content="([^"]*)" \/>/);
  const renderedSummary = matchFirst(text, /data-recommendation-summary="([^"]*)"/);
  const expectedTitle = escapeHtmlForValidation(`${displayPokemonName(pokemon)} | Pokopia Color Pattern`);
  const expectedDescription = escapeHtmlForValidation(summary.text);
  const expectedCanonicalUrl = staticPageUrl(pokemon.slug);
  const expectedImageUrl = staticAssetUrl(pokemon);

  if (!title) {
    issues.push({ file, message: "Static Pokemon page must include a title" });
  } else {
    addMetadataValue(accumulator.titles, title, file);
    if (title !== expectedTitle) {
      issues.push({ file, message: `Title must match current Pokemon metadata: expected ${expectedTitle}, got ${title}` });
    }
  }
  if (!description) {
    issues.push({ file, message: "Static Pokemon page must include a description meta tag" });
  } else {
    addMetadataValue(accumulator.descriptions, description, file);
    if (description !== expectedDescription) {
      issues.push({ file, message: "Description metadata must match current Pokemon recommendation summary" });
    }
  }
  if (description && renderedSummary && description !== renderedSummary) {
    issues.push({ file, message: "Description metadata must match the rendered recommendation summary" });
  }

  const canonicalUrl = matchFirst(text, /<link rel="canonical" href="([^"]*)" \/>/);
  const ogTitle = matchFirst(text, /<meta property="og:title" content="([^"]*)" \/>/);
  const ogDescription = matchFirst(text, /<meta property="og:description" content="([^"]*)" \/>/);
  const ogImage = matchFirst(text, /<meta property="og:image" content="([^"]*)" \/>/);
  const ogUrl = matchFirst(text, /<meta property="og:url" content="([^"]*)" \/>/);
  const twitterTitle = matchFirst(text, /<meta name="twitter:title" content="([^"]*)" \/>/);
  const twitterDescription = matchFirst(text, /<meta name="twitter:description" content="([^"]*)" \/>/);
  const twitterImage = matchFirst(text, /<meta name="twitter:image" content="([^"]*)" \/>/);
  if (title && ogTitle !== title) {
    issues.push({ file, message: "Open Graph title must match page title" });
  }
  if (title && twitterTitle !== title) {
    issues.push({ file, message: "Twitter title must match page title" });
  }
  if (description && ogDescription !== description) {
    issues.push({ file, message: "Open Graph description must match page description" });
  }
  if (description && twitterDescription !== description) {
    issues.push({ file, message: "Twitter description must match page description" });
  }
  if (canonicalUrl !== expectedCanonicalUrl) {
    issues.push({ file, message: `Canonical URL must be absolute and match current slug ${pokemon.slug}` });
  }
  if (ogUrl !== expectedCanonicalUrl) {
    issues.push({ file, message: `Open Graph URL must be absolute and match current slug ${pokemon.slug}` });
  }
  if (ogImage !== expectedImageUrl) {
    issues.push({ file, message: "Open Graph image must be an absolute URL for the current Pokemon image" });
  }
  if (twitterImage !== expectedImageUrl) {
    issues.push({ file, message: "Twitter image must be an absolute URL for the current Pokemon image" });
  }
}

function validateStaticRecommendationSummary(
  file: string,
  pokemon: StaticPokemonEntry,
  text: string,
  recommendationResult: DistRecommendationReadResult,
  summary: RecommendationSummaryText,
  itemBySlug: Map<string, StaticItemEntry>,
): void {
  const summaryAttribute = matchFirst(text, /data-recommendation-summary="([^"]*)"/);
  const expectedSummary = escapeHtmlForValidation(summary.text);
  const expectedCount = recommendationCount(recommendationResult);
  if (summaryAttribute !== expectedSummary) {
    issues.push({ file, message: "Rendered recommendation summary must match current slug generated recommendation data" });
  }
  if (!text.includes(`data-recommendation-status="${summary.status}"`)) {
    issues.push({ file, message: `Static page recommendation status must be ${summary.status}` });
  }
  if (!text.includes(`data-recommendation-count="${expectedCount}"`)) {
    issues.push({ file, message: `Static page recommendation count must match generated data count ${expectedCount}` });
  }
  if (recommendationResult.missing) {
    if (!text.includes("当前缺少推荐数据文件")) {
      issues.push({ file, message: "Missing recommendation static page must render recoverable missing-data summary" });
    }
    return;
  }
  const recommendations = recommendationResult.data;
  if (!isRecord(recommendations)) {
    return;
  }
  if (recommendations.pokemonSlug !== pokemon.slug) {
    issues.push({ file, message: `Static page recommendation data slug mismatch: expected ${pokemon.slug}, got ${String(recommendations.pokemonSlug)}` });
  }
  if (!Array.isArray(recommendations.recommendations)) {
    issues.push({ file, message: "Recommendation data must include recommendations array for static page validation" });
    return;
  }
  if (expectedCount === 0) {
    if (!text.includes('data-recommendation-status="empty"') || !text.includes("当前数据和规则暂未产生推荐搭配")) {
      issues.push({ file, message: "Empty recommendation static page must render recoverable empty summary" });
    }
    return;
  }

  if (!text.includes('data-recommendation-status="ready"')) {
    issues.push({ file, message: "Non-empty recommendation static page must render ready summary status" });
  }
  const expectedNames = recommendations.recommendations.slice(0, 3).map((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ file, message: `Recommendation ${index} must be an object for static page validation` });
      return null;
    }
    const itemSlug = typeof entry.itemSlug === "string" ? entry.itemSlug : "";
    const item = itemBySlug.get(itemSlug);
    if (!item) {
      issues.push({ file, message: `Recommendation ${index} item ${itemSlug || "<missing>"} is missing from compact item lookup` });
      return null;
    }
    if (item.recommendation.itemPrimaryColor && !text.includes(escapeHtmlForValidation(item.recommendation.itemPrimaryColor))) {
      issues.push({ file, message: `Static recommendation ${index + 1} must render compact item primary color for ${item.slug}` });
    }
    return escapeHtmlForValidation(displayStaticItemName(item));
  });
  const summaryText = summaryAttribute ?? "";
  let lastIndex = -1;
  expectedNames.forEach((name, index) => {
    if (!name) {
      return;
    }
    const nextIndex = summaryText.indexOf(name, lastIndex + 1);
    if (nextIndex === -1) {
      issues.push({ file, message: `Static summary is missing recommendation item ${index + 1} in generated-data order` });
      return;
    }
    lastIndex = nextIndex;
  });
}

function validateSsgGenerationSummary(
  report: unknown | null,
  expectedSlugs: string[],
  expectedPages: ExpectedSsgPageRecord[],
  expectedFallbacks: ExpectedSsgFallbackRecord[],
): void {
  if (!isRecord(report)) {
    issues.push({ file: ssgGenerationSummaryPath, message: "Expected SSG generation summary object" });
    return;
  }
  if (report.schemaVersion !== "ssg-generation-summary.v1") {
    issues.push({ file: ssgGenerationSummaryPath, message: "Expected schemaVersion ssg-generation-summary.v1" });
  }
  const expectedSlugSet = new Set(expectedSlugs);
  validateSsgReportSummary(report.summary, expectedSlugs.length, expectedFallbacks);
  validateSsgReportPages(report.pages, expectedSlugSet, expectedPages);
  validateSsgReportFallbacks(report.fallbacks, expectedSlugSet, expectedFallbacks);
}

function validateSsgReportSummary(summary: unknown, expectedCount: number, expectedFallbacks: ExpectedSsgFallbackRecord[]): void {
  if (!isRecord(summary)) {
    issues.push({ file: ssgGenerationSummaryPath, message: "Expected summary object" });
    return;
  }
  const emptyFallbackCount = expectedFallbacks.filter((fallback) => fallback.fallbackType === "empty_recommendations").length;
  const missingFallbackCount = expectedFallbacks.filter((fallback) => fallback.fallbackType === "missing_recommendation_file").length;
  const expectedSummaryFields: Array<[string, number]> = [
    ["pokemonCount", expectedCount],
    ["pagesGenerated", expectedCount],
    ["metadataCount", expectedCount],
    ["fallbackCount", expectedFallbacks.length],
    ["emptyRecommendationCount", emptyFallbackCount],
    ["missingRecommendationFileCount", missingFallbackCount],
  ];
  expectedSummaryFields.forEach(([field, expected]) => {
    if (summary[field] !== expected) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected summary.${field} ${expected}, got ${String(summary[field])}` });
    }
  });
  if (summary.siteUrl !== siteOrigin) {
    issues.push({ file: ssgGenerationSummaryPath, message: `Expected summary.siteUrl ${siteOrigin}, got ${String(summary.siteUrl)}` });
  }
}

function validateSsgReportPages(pages: unknown, expectedSlugSet: Set<string>, expectedPages: ExpectedSsgPageRecord[]): void {
  if (!Array.isArray(pages)) {
    issues.push({ file: ssgGenerationSummaryPath, message: "Expected pages array" });
    return;
  }
  if (pages.length !== expectedSlugSet.size) {
    issues.push({ file: ssgGenerationSummaryPath, message: `Expected ${expectedSlugSet.size} page records, got ${pages.length}` });
  }
  const seen = new Set<string>();
  const expectedPageBySlug = new Map(expectedPages.map((page) => [page.pokemonSlug, page]));
  pages.forEach((page, index) => {
    if (!isRecord(page) || typeof page.pokemonSlug !== "string") {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected pages[${index}] to include pokemonSlug` });
      return;
    }
    if (!expectedSlugSet.has(page.pokemonSlug)) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Unexpected page slug ${page.pokemonSlug}` });
    }
    if (seen.has(page.pokemonSlug)) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Duplicate page slug ${page.pokemonSlug}` });
    }
    seen.add(page.pokemonSlug);
    const expectedPage = expectedPageBySlug.get(page.pokemonSlug);
    if (!expectedPage) {
      return;
    }
    if (page.outputPath !== expectedPage.outputPath) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Unexpected outputPath for ${page.pokemonSlug}` });
    }
    if (page.recommendationCount !== expectedPage.recommendationCount) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected recommendationCount ${expectedPage.recommendationCount} for ${page.pokemonSlug}` });
    }
    if (page.fallbackType !== expectedPage.fallbackType) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected fallbackType ${String(expectedPage.fallbackType)} for ${page.pokemonSlug}` });
    }
  });
}

function validateSsgReportFallbacks(fallbacks: unknown, expectedSlugSet: Set<string>, expectedFallbacks: ExpectedSsgFallbackRecord[]): void {
  if (!Array.isArray(fallbacks)) {
    issues.push({ file: ssgGenerationSummaryPath, message: "Expected fallbacks array" });
    return;
  }
  if (fallbacks.length !== expectedFallbacks.length) {
    issues.push({ file: ssgGenerationSummaryPath, message: `Expected ${expectedFallbacks.length} fallback records, got ${fallbacks.length}` });
  }
  const expectedFallbackBySlug = new Map(expectedFallbacks.map((fallback) => [fallback.pokemonSlug, fallback]));
  const fallbackSlugs = new Set<string>();
  fallbacks.forEach((fallback, index) => {
    if (!isRecord(fallback) || typeof fallback.pokemonSlug !== "string") {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected fallbacks[${index}] to include pokemonSlug` });
      return;
    }
    if (!expectedSlugSet.has(fallback.pokemonSlug)) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Unexpected fallback slug ${fallback.pokemonSlug}` });
    }
    fallbackSlugs.add(fallback.pokemonSlug);
    const expectedFallback = expectedFallbackBySlug.get(fallback.pokemonSlug);
    if (!expectedFallback) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Unexpected fallback record for non-fallback slug ${fallback.pokemonSlug}` });
      return;
    }
    if (fallback.fallbackType !== expectedFallback.fallbackType) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected fallback type ${expectedFallback.fallbackType} for ${fallback.pokemonSlug}` });
    }
    if (fallback.recommendationCount !== expectedFallback.recommendationCount) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected fallback recommendationCount ${expectedFallback.recommendationCount} for ${fallback.pokemonSlug}` });
    }
    if (typeof fallback.reason !== "string" || fallback.reason.length === 0) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Fallback reason missing for ${fallback.pokemonSlug}` });
    }
  });
  expectedFallbackBySlug.forEach((_, slug) => {
    if (!fallbackSlugs.has(slug)) {
      issues.push({ file: ssgGenerationSummaryPath, message: `Expected fallback ${slug} is missing matching fallback record` });
    }
  });
}

async function readSsgGenerationSummary(): Promise<unknown | null> {
  let text: string;
  try {
    text = await readFile(ssgGenerationSummaryPath, "utf8");
  } catch (error) {
    issues.push({ file: ssgGenerationSummaryPath, message: `Unable to read SSG generation summary: ${error instanceof Error ? error.message : String(error)}` });
    return null;
  }
  const report = parseJson(text, ssgGenerationSummaryPath);
  await validateSensitiveTextFiles([ssgGenerationSummaryPath], "SSG generation summary");
  return report;
}

function missingRecommendationFilesFromReport(report: unknown | null): Set<string> {
  const missingFiles = new Set<string>();
  if (!isRecord(report) || !Array.isArray(report.fallbacks)) {
    return missingFiles;
  }
  report.fallbacks.filter(isRecord).forEach((fallback) => {
    if (fallback.fallbackType === "missing_recommendation_file" && typeof fallback.pokemonSlug === "string") {
      missingFiles.add(`recommendations/${fallback.pokemonSlug}.json`);
    }
  });
  return missingFiles;
}

function expectedRecommendationSummary(
  pokemon: StaticPokemonEntry,
  recommendationResult: DistRecommendationReadResult,
  itemBySlug: Map<string, StaticItemEntry>,
): RecommendationSummaryText {
  const displayName = displayPokemonName(pokemon);
  const slugLabel = `#${pokemon.slug}`;
  if (recommendationResult.missing) {
    return {
      status: "missing",
      text: `${displayName}（${slugLabel}）主色 ${pokemon.primaryColor}；当前缺少推荐数据文件，静态页先展示色板与可恢复空推荐摘要。`,
    };
  }
  const recommendations = recommendationResult.data;
  if (isRecord(recommendations) && Array.isArray(recommendations.recommendations) && recommendations.recommendations.length > 0) {
    const names = recommendations.recommendations
      .slice(0, 3)
      .map((entry) => {
        if (!isRecord(entry) || typeof entry.itemSlug !== "string") {
          return null;
        }
        const item = itemBySlug.get(entry.itemSlug);
        return item ? displayStaticItemName(item) : null;
      })
      .filter((name): name is string => typeof name === "string")
      .join("、");
    return {
      status: "ready",
      text: `${displayName}（${slugLabel}）主色 ${pokemon.primaryColor}，推荐搭配：${names}。`,
    };
  }
  return {
    status: "empty",
    text: `${displayName}（${slugLabel}）主色 ${pokemon.primaryColor}；当前数据和规则暂未产生推荐搭配，可先查看色板。`,
  };
}

function displayStaticItemName(item: StaticItemEntry): string {
  return item.nameZh || item.name;
}

function recommendationCount(recommendationResult: DistRecommendationReadResult): number {
  const recommendations = recommendationResult.data;
  if (!isRecord(recommendations) || !Array.isArray(recommendations.recommendations)) {
    return 0;
  }
  return recommendations.recommendations.length;
}

function expectedFallbackType(recommendationResult: DistRecommendationReadResult): ExpectedSsgPageRecord["fallbackType"] {
  if (recommendationResult.missing) {
    return "missing_recommendation_file";
  }
  return recommendationCount(recommendationResult) === 0 ? "empty_recommendations" : null;
}

function displayPokemonName(pokemon: StaticPokemonEntry): string {
  return pokemon.zhName ? `${pokemon.zhName} / ${pokemon.name}` : pokemon.name;
}

function addMetadataValue(values: Map<string, string[]>, value: string, file: string): void {
  const files = values.get(value) ?? [];
  files.push(file);
  values.set(value, files);
}

function validateUniqueStaticMetadata(accumulator: StaticMetadataAccumulator): void {
  validateUniqueMetadataMap("title", accumulator.titles);
  validateUniqueMetadataMap("description", accumulator.descriptions);
}

function validateUniqueMetadataMap(label: string, values: Map<string, string[]>): void {
  values.forEach((files, value) => {
    if (files.length > 1) {
      issues.push({ file: files[0], message: `Static Pokemon page ${label} must be unique; duplicated by ${files.slice(1, 4).join(", ")} for ${value}` });
    }
  });
}

function staticPageUrl(slug: string): string {
  return `${siteOrigin}/pokemon/${slug}/`;
}

function staticAssetUrl(pokemon: StaticPokemonEntry): string {
  return `${siteOrigin}${pokemon.imagePath}`;
}

function matchFirst(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1] ?? null;
}

function escapeHtmlForValidation(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateRootAbsoluteHtmlReferences(file: string, text: string): void {
  const attributePattern = /\b(?:href|src)=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(text)) !== null) {
    const value = match[1];
    if (isSafeNonPathReference(value)) {
      continue;
    }
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("..")) {
      issues.push({ file, message: `Expected root-absolute static page asset reference, got ${value}` });
    }
  }
}

function validateStaticRuntimeImageReferences(file: string, text: string): void {
  const imagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(text)) !== null) {
    const value = match[1];
    if (!value.startsWith("/assets/runtime/")) {
      issues.push({ file, message: `Static page image must use runtime asset path, got ${value}` });
    }
  }
}

function isSafeNonPathReference(value: string): boolean {
  return value.startsWith("#") || value.startsWith("data:") || value.startsWith("mailto:") || value.startsWith("tel:") || /^https?:\/\//.test(value);
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
  validateRecommendationTextSizeBudget(recommendationTexts, recommendationsDir);

  validateRecommendationCoverage(pokemonIndex, recommendations);
}

async function validateRecommendationBundleSizeBudget(directory: string): Promise<void> {
  if (!existsSync(resolve(projectRoot, directory))) {
    issues.push({ file: directory, message: "Expected recommendation data directory to exist for size budget validation" });
    return;
  }
  const files = await listFiles(resolve(projectRoot, directory), [".json"]);
  const texts = await Promise.all(files.map(async (file) => [relative(projectRoot, file), await readFile(file, "utf8")] as const));
  validateRecommendationTextSizeBudget(texts, directory);
}

function validateRecommendationTextSizeBudget(texts: Array<readonly [string, string]>, label: string): void {
  const rawBytes = texts.reduce((sum, [, text]) => sum + Buffer.byteLength(text, "utf8"), 0);
  const gzipBytes = texts.reduce((sum, [, text]) => sum + gzipSync(text).length, 0);
  if (rawBytes >= recommendationRawTotalLimit) {
    issues.push({ file: label, message: `Recommendation raw total exceeds ${recommendationRawTotalLimit} byte budget: ${rawBytes}` });
  }
  if (gzipBytes >= recommendationGzipTotalLimit) {
    issues.push({ file: label, message: `Recommendation gzip total exceeds ${recommendationGzipTotalLimit} byte budget: ${gzipBytes}` });
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

function validateNoDocsSourceReferences(sourceFiles: Map<string, string>, label: string): void {
  const forbiddenPattern = /\/docs\/pokopia_image_sources\//;
  sourceFiles.forEach((text, file) => {
    if (forbiddenPattern.test(text)) {
      issues.push({
        file: relative(projectRoot, file),
        message: `${label} must not reference /docs/pokopia_image_sources/**`,
      });
    }
  });
}

function validateRuntimeAssetReferences(sourceFiles: Map<string, string>, runtimeAssetPaths: Set<string>): Set<string> {
  const referencedRuntimeAssetPaths = new Set<string>();
  const runtimePathPattern = /\/assets\/runtime\/[a-zA-Z0-9/_\-.]+/g;
  sourceFiles.forEach((text, file) => {
    for (const match of text.matchAll(runtimePathPattern)) {
      const runtimePath = match[0];
      if (runtimePath === "/assets/runtime/asset-manifest.json") {
        continue;
      }
      referencedRuntimeAssetPaths.add(runtimePath);
      if (!runtimeAssetPaths.has(runtimePath)) {
        issues.push({
          file: relative(projectRoot, file),
          message: `Runtime asset reference is not declared in asset-manifest.json: ${runtimePath}`,
        });
      }
    }
  });
  return referencedRuntimeAssetPaths;
}

function validateManifestRuntimeAssetsAreReferenced(
  runtimeAssetPaths: Set<string>,
  referencedRuntimeAssetPaths: Set<string>,
): void {
  runtimeAssetPaths.forEach((runtimePath) => {
    if (!referencedRuntimeAssetPaths.has(runtimePath)) {
      issues.push({
        file: runtimeAssetManifestPath,
        message: `Runtime asset is declared but not referenced by runtime output: ${runtimePath}`,
      });
    }
  });
}

async function validateSensitiveRuntimeData(files: string[]): Promise<void> {
  await validateSensitiveTextFiles(files, "runtime data");
}

async function validateSensitiveTextFiles(files: string[], label: string): Promise<void> {
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
        issues.push({ file, message: `Unable to read ${label} for sensitive scan: ${error instanceof Error ? error.message : String(error)}` });
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

async function validateDiagnosticsReportFile(): Promise<void> {
  if (!existsSync(resolve(projectRoot, recommendationDiagnosticsPath))) {
    issues.push({ file: recommendationDiagnosticsPath, message: "Expected recommendation diagnostics report to exist" });
    return;
  }

  const text = await readFile(recommendationDiagnosticsPath, "utf8");
  const report = parseJson(text, recommendationDiagnosticsPath);
  if (!isRecord(report)) {
    issues.push({ file: recommendationDiagnosticsPath, message: "Expected diagnostics report object" });
    return;
  }
  if (report.schemaVersion !== "recommendation-diagnostics.v1") {
    issues.push({ file: recommendationDiagnosticsPath, message: "Expected schemaVersion recommendation-diagnostics.v1" });
  }
  if (!isRecord(report.summary)) {
    issues.push({ file: recommendationDiagnosticsPath, message: "Expected summary object" });
  }
  if (!Array.isArray(report.pokemon)) {
    issues.push({ file: recommendationDiagnosticsPath, message: "Expected pokemon diagnostics array" });
  }
  if (text.includes(projectRoot) || text.includes("/Users/")) {
    issues.push({ file: recommendationDiagnosticsPath, message: "contains local absolute project/home path" });
  }
  await validateSensitiveTextFiles([recommendationDiagnosticsPath], "diagnostics report");
}

async function validateRuntimeAssetSourcesReport(): Promise<void> {
  if (!existsSync(resolve(projectRoot, runtimeAssetSourcesPath))) {
    issues.push({ file: runtimeAssetSourcesPath, message: "Expected runtime asset sources report to exist" });
    return;
  }

  const text = await readFile(runtimeAssetSourcesPath, "utf8");
  const report = parseJson(text, runtimeAssetSourcesPath);
  if (!isRecord(report)) {
    issues.push({ file: runtimeAssetSourcesPath, message: "Expected runtime asset sources report object" });
    return;
  }
  if (report.schemaVersion !== "runtime-asset-sources.v1") {
    issues.push({ file: runtimeAssetSourcesPath, message: "Expected schemaVersion runtime-asset-sources.v1" });
  }
  if (!Array.isArray(report.assets)) {
    issues.push({ file: runtimeAssetSourcesPath, message: "Expected assets array" });
    return;
  }

  const seen = new Set<string>();
  report.assets.forEach((asset, index) => {
    if (!isRecord(asset)) {
      issues.push({ file: runtimeAssetSourcesPath, message: `Expected assets[${index}] object` });
      return;
    }
    const sourceCategory = asset.sourceCategory;
    const slug = typeof asset.slug === "string" ? asset.slug : "";
    const sourcePath = typeof asset.sourcePath === "string" ? asset.sourcePath : "";
    const runtimePath = typeof asset.runtimePath === "string" ? asset.runtimePath : "";
    if (sourceCategory !== "pokemon" && sourceCategory !== "item") {
      issues.push({ file: runtimeAssetSourcesPath, message: `Expected assets[${index}].sourceCategory pokemon or item` });
    }
    if (!sourcePath.startsWith("docs/pokopia_image_sources/") || sourcePath.includes("..") || sourcePath.includes("\\")) {
      issues.push({ file: runtimeAssetSourcesPath, message: `Invalid sourcePath for ${slug || index}` });
    } else if (!existsSync(resolve(projectRoot, sourcePath))) {
      issues.push({ file: runtimeAssetSourcesPath, message: `Source asset does not exist for ${slug}: ${sourcePath}` });
    }
    const expectedRuntimePrefix = sourceCategory === "pokemon" ? "/assets/runtime/pokemon/" : "/assets/runtime/items/";
    if (!runtimePath.startsWith(expectedRuntimePrefix) || runtimePath.includes("..") || runtimePath.includes("\\")) {
      issues.push({ file: runtimeAssetSourcesPath, message: `Invalid runtimePath for ${slug || index}` });
    }
    if (!runtimePath.endsWith(".webp")) {
      issues.push({ file: runtimeAssetSourcesPath, message: `runtimePath must use optimized .webp output for ${slug || index}` });
    }
    const key = `${String(sourceCategory)}:${slug}`;
    if (seen.has(key)) {
      issues.push({ file: runtimeAssetSourcesPath, message: `Duplicate runtime asset source ${key}` });
    }
    seen.add(key);
  });
}

async function validateRuntimeDataTree(root: string, allowedMissingFiles: Set<string> = new Set()): Promise<string[]> {
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
    if (!seenFiles.has(file) && !allowedMissingFiles.has(file)) {
      issues.push({ file: `${root}/${file}`, message: "Missing expected runtime data file" });
    }
  });

  return Array.from(seenFiles, (file) => `${root}/${file}`).sort((left, right) => left.localeCompare(right, "en"));
}

async function expectedRuntimeDataAllowlist(root: string): Promise<{ directories: Set<string>; files: Set<string> }> {
  const files = new Set(["compact-items.json", "pokemon-index.json"]);
  if (root === "generated/data") {
    files.add("item-colors.json");
  }
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
  const deterministicContractPaths = [...runtimeFiles, recommendationDiagnosticsPath, runtimeAssetSourcesPath, "src/data/schemas.ts"];
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

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function normalizeSiteOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`POKOPIA_SITE_URL must use http or https, got ${value}`);
  }
  return url.origin;
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
  sizeBytes: number;
};

async function listTreeEntries(root: string, prefix = ""): Promise<TreeEntry[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return [{ path: entryPath, isDirectory: true, sizeBytes: 0 }, ...(await listTreeEntries(path, entryPath))];
      }
      const fileStat = await stat(path);
      return [{ path: entryPath, isDirectory: false, sizeBytes: fileStat.size }];
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
