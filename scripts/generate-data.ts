import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  COMPACT_ITEMS_SCHEMA_VERSION,
  ITEM_COLORS_SCHEMA_VERSION,
  POKEMON_INDEX_SCHEMA_VERSION,
  RECOMMENDATIONS_SCHEMA_VERSION,
  type CompactItem,
  type CompactItemsData,
  type ItemColorEntry,
  type ItemColorsData,
  type PokemonIndexData,
  type PokemonIndexEntry,
  type PokemonMetadataOverridesData,
  type RecommendationsData,
  validateCompactItemsData,
  validateItemColorsData,
  validatePokemonIndexData,
  validatePokemonMetadataOverridesData,
  validateRecommendationsData,
} from "../src/data/schemas.js";
import { buildRecommendationDataSet, type RecommendationDiagnosticsReport } from "../src/domain/recommendation-data.js";
import { resolvePokemonMetadataOverrideFields } from "../src/domain/pokemon-metadata.js";
import { DEFAULT_FALLBACK_COLOR, extractImagePalette } from "./lib/image-colors.js";
import { parseCsv, type CsvRow } from "./lib/csv.js";
import { writeJsonFile } from "./lib/write-json.js";

type GenerationIssue = {
  file: string;
  row?: number;
  slug?: string;
  field?: string;
  message: string;
};

type RawJsonItem = {
  id?: unknown;
  slug?: unknown;
  menu_category?: unknown;
  color_variants?: unknown;
  variantSrcs?: unknown;
};

const projectRoot = process.cwd();

const itemManifestPath = "docs/pokopia_image_sources/item_portraits/manifest.csv";
const placeableCsvPath = "docs/pokopia_image_sources/pokopiadex_placeable_items.csv";
const placeableJsonPath = "docs/pokopia_image_sources/pokopiadex_placeable_items.json";
const pokemonManifestPath = "docs/pokopia_image_sources/pokemon_portraits/manifest.csv";
const pokemonOverridePath = "data/overrides/pokemon-metadata.json";

const compactItemsOutputPath = "generated/data/compact-items.json";
const itemColorsOutputPath = "generated/data/item-colors.json";
const pokemonIndexOutputPath = "generated/data/pokemon-index.json";
const recommendationsOutputDir = "generated/data/recommendations";
const recommendationDiagnosticsOutputPath = "generated/reports/recommendation-diagnostics.json";

const maxCompactItemsGzipBytes = 50 * 1024;
const maxItemColorsGzipBytes = 25 * 1024;
const maxPokemonIndexGzipBytes = 40 * 1024;
const maxRecommendationGzipBytes = 5 * 1024;
const recommendationPageSize = 10;
const expectedItemCount = 1219;
const expectedPokemonCount = 311;

const absoluteItemManifestPath = resolve(projectRoot, itemManifestPath);
const absolutePlaceableCsvPath = resolve(projectRoot, placeableCsvPath);
const absolutePlaceableJsonPath = resolve(projectRoot, placeableJsonPath);
const absolutePokemonManifestPath = resolve(projectRoot, pokemonManifestPath);
const absolutePokemonOverridePath = resolve(projectRoot, pokemonOverridePath);
const absoluteCompactItemsOutputPath = resolve(projectRoot, compactItemsOutputPath);
const absoluteItemColorsOutputPath = resolve(projectRoot, itemColorsOutputPath);
const absolutePokemonIndexOutputPath = resolve(projectRoot, pokemonIndexOutputPath);
const absoluteRecommendationsOutputDir = resolve(projectRoot, recommendationsOutputDir);
const absoluteRecommendationDiagnosticsOutputPath = resolve(projectRoot, recommendationDiagnosticsOutputPath);
const localItemImageRoot = resolve(projectRoot, "docs/pokopia_image_sources/item_portraits");
const localPokemonImageRoot = resolve(projectRoot, "docs/pokopia_image_sources/pokemon_portraits");

const validateOnly = process.argv.includes("--validate-only");

if (validateOnly) {
  await validateExistingOutputs();
} else {
  await generateData();
}

async function generateData(): Promise<void> {
  const issues: GenerationIssue[] = [];
  const [manifestCsv, placeableCsv, placeableJsonText, pokemonCsv, overrideText] = await Promise.all([
    readFile(absoluteItemManifestPath, "utf8"),
    readFile(absolutePlaceableCsvPath, "utf8"),
    readFile(absolutePlaceableJsonPath, "utf8"),
    readFile(absolutePokemonManifestPath, "utf8"),
    readFile(absolutePokemonOverridePath, "utf8"),
  ]);

  const overrides = parsePokemonOverrides(overrideText, issues);
  const compactItems = buildCompactItems(manifestCsv, placeableCsv, placeableJsonText, issues);
  const itemColors = await buildItemColors(compactItems.items, issues);
  const pokemonIndex = await buildPokemonIndex(pokemonCsv, overrides, issues);
  const recommendationBuild = buildRecommendations(pokemonIndex, compactItems, itemColors, overrides, issues);
  const recommendations = recommendationBuild.recommendations;
  const recommendationDiagnostics = recommendationBuild.diagnostics;

  validateAllData(compactItems, itemColors, pokemonIndex, overrides, recommendations, issues);
  validateRecommendationDiagnostics(recommendationDiagnostics, recommendations, issues);

  if (issues.length > 0) {
    printIssues("Data generation failed", issues);
    process.exitCode = 1;
    return;
  }

  await rm(absoluteRecommendationsOutputDir, { recursive: true, force: true });
  await Promise.all([
    writeJsonFile(absoluteCompactItemsOutputPath, compactItems),
    writeJsonFile(absoluteItemColorsOutputPath, itemColors),
    writeJsonFile(absolutePokemonIndexOutputPath, pokemonIndex),
    writeJsonFile(absoluteRecommendationDiagnosticsOutputPath, recommendationDiagnostics),
    ...recommendations.map((data) => writeJsonFile(resolve(absoluteRecommendationsOutputDir, `${data.pokemonSlug}.json`), data)),
  ]);

  const compactGzipBytes = gzipSync(serializeJsonForOutput(compactItems)).length;
  const largestRecommendation = largestGzipRecommendation(recommendations);
  console.log(`Generated ${compactItemsOutputPath} with ${compactItems.items.length} compact items (${compactGzipBytes} gzip bytes).`);
  console.log(`Generated ${itemColorsOutputPath} with ${itemColors.items.length} item colors.`);
  console.log(`Generated ${pokemonIndexOutputPath} with ${pokemonIndex.pokemon.length} Pokemon.`);
  console.log(
    `Generated ${recommendations.length} Pokemon recommendation files under ${recommendationsOutputDir} (largest ${largestRecommendation.gzipBytes} gzip bytes: ${largestRecommendation.pokemonSlug}).`,
  );
  console.log(
    `Generated ${recommendationDiagnosticsOutputPath} (${recommendationDiagnostics.summary.emptyCount} empty, ${recommendationDiagnostics.summary.sparseCount} sparse).`,
  );
}

async function validateExistingOutputs(): Promise<void> {
  const issues: GenerationIssue[] = [];
  const [compactText, itemColorsText, pokemonIndexText, overrideText, recommendationDiagnosticsText, recommendationFiles] = await Promise.all([
    readFile(absoluteCompactItemsOutputPath, "utf8"),
    readFile(absoluteItemColorsOutputPath, "utf8"),
    readFile(absolutePokemonIndexOutputPath, "utf8"),
    readFile(absolutePokemonOverridePath, "utf8"),
    readFile(absoluteRecommendationDiagnosticsOutputPath, "utf8"),
    readRecommendationOutputFiles(issues),
  ]);

  const compactItems = parseJsonValue(compactText, compactItemsOutputPath, issues);
  const itemColors = parseJsonValue(itemColorsText, itemColorsOutputPath, issues);
  const pokemonIndex = parseJsonValue(pokemonIndexText, pokemonIndexOutputPath, issues);
  const overrides = parseJsonValue(overrideText, pokemonOverridePath, issues);
  const recommendationDiagnostics = parseJsonValue(recommendationDiagnosticsText, recommendationDiagnosticsOutputPath, issues);
  const recommendations = recommendationFiles.map((file) => parseJsonValue(file.text, file.path, issues));
  validateRecommendationOutputPaths(recommendationFiles, recommendations, issues);

  validateAllData(compactItems, itemColors, pokemonIndex, overrides, recommendations, issues);
  validateRecommendationDiagnostics(recommendationDiagnostics, recommendations, issues);

  if (issues.length > 0) {
    printIssues("Data validation failed", issues);
    process.exitCode = 1;
    return;
  }

  const compactCount = Array.isArray((compactItems as { items?: unknown }).items)
    ? (compactItems as { items: unknown[] }).items.length
    : 0;
  const itemColorCount = Array.isArray((itemColors as { items?: unknown }).items)
    ? (itemColors as { items: unknown[] }).items.length
    : 0;
  const pokemonCount = Array.isArray((pokemonIndex as { pokemon?: unknown }).pokemon)
    ? (pokemonIndex as { pokemon: unknown[] }).pokemon.length
    : 0;
  console.log(
    `Validated ${compactItemsOutputPath} (${compactCount}), ${itemColorsOutputPath} (${itemColorCount}), ${pokemonIndexOutputPath} (${pokemonCount}), and ${recommendations.length} recommendation files.`,
  );
}

function buildCompactItems(manifestCsv: string, placeableCsv: string, placeableJsonText: string, issues: GenerationIssue[]): CompactItemsData {
  const manifest = parseCsv(manifestCsv);
  const placeable = parseCsv(placeableCsv);
  manifest.issues.forEach((message) => issues.push({ file: itemManifestPath, message }));
  placeable.issues.forEach((message) => issues.push({ file: placeableCsvPath, message }));

  const placeableBySlug = indexCsvRowsBySlug(placeable.rows, placeableCsvPath, issues);
  const rawJsonBySlug = parsePlaceableJson(placeableJsonText, issues);
  const compactRows = manifest.rows
    .filter((row) => row.values.status === "ok" && row.values.kind === "placeable_item")
    .map((row) => toCompactItem(row, placeableBySlug.get(row.values.slug), rawJsonBySlug.get(row.values.slug), issues))
    .sort(compareCompactItems);

  return {
    schemaVersion: COMPACT_ITEMS_SCHEMA_VERSION,
    generatedFrom: {
      itemManifestPath,
      placeableCsvPath,
      placeableJsonPath,
      rawBoundary: "docs/pokopia_image_sources/**",
    },
    summary: {
      itemCount: compactRows.length,
      categoryCounts: countBy(compactRows, (item) => item.category ?? "Uncategorized"),
      tagCounts: countTags(compactRows),
    },
    items: compactRows,
  };
}

async function buildItemColors(items: CompactItem[], issues: GenerationIssue[]): Promise<ItemColorsData> {
  const colorRows = await mapWithConcurrency(items, 12, async (item): Promise<ItemColorEntry> => {
    const imagePath = resolve(projectRoot, item.imagePath.slice(1));
    const result = await extractImagePalette(imagePath);

    if (result.status === "ok") {
      return {
        slug: item.slug,
        itemPrimaryColor: result.palette[0]?.hex ?? DEFAULT_FALLBACK_COLOR,
        colorSource: "extracted",
        fallbackReason: null,
      };
    }

    return {
      slug: item.slug,
      itemPrimaryColor: DEFAULT_FALLBACK_COLOR,
      colorSource: "fallback",
      fallbackReason: result.reason,
    };
  });

  const fallbackCount = colorRows.filter((item) => item.colorSource === "fallback").length;

  return {
    schemaVersion: ITEM_COLORS_SCHEMA_VERSION,
    generatedFrom: {
      compactItemsPath: compactItemsOutputPath,
      rawBoundary: "docs/pokopia_image_sources/**",
    },
    summary: {
      itemCount: colorRows.length,
      fallbackCount,
    },
    items: colorRows.sort((left, right) => left.slug.localeCompare(right.slug, "en")),
  };
}

async function buildPokemonIndex(
  pokemonCsv: string,
  overrides: PokemonMetadataOverridesData,
  issues: GenerationIssue[],
): Promise<PokemonIndexData> {
  const manifest = parseCsv(pokemonCsv);
  manifest.issues.forEach((message) => issues.push({ file: pokemonManifestPath, message }));
  const rows = manifest.rows.filter((row) => row.values.status === "ok" && row.values.kind === "pokemon");
  const seenPokemonSlugs = new Set<string>();

  const pokemonRows = await mapWithConcurrency(rows, 12, async (row): Promise<PokemonIndexEntry> => {
    const name = requireField(row.values, "name", pokemonManifestPath, row.rowNumber, issues);
    const slug = pokemonSlug(row.values, name);
    seenPokemonSlugs.add(slug);
    const override = overrides.pokemon[slug];
    const sequence = requireField(row.values, "sequence", pokemonManifestPath, row.rowNumber, issues, slug);
    if (!/^\d+$/.test(sequence)) {
      issues.push({ file: pokemonManifestPath, row: row.rowNumber, slug, field: "sequence", message: "Expected numeric sequence" });
    }
    const imagePath = toRootAbsolutePath(requireField(row.values, "relative_path", pokemonManifestPath, row.rowNumber, issues, slug));
    const localImagePath = resolve(projectRoot, imagePath.slice(1));
    const overrideFields = resolvePokemonMetadataOverrideFields(slug, override, pokemonOverridePath, DEFAULT_FALLBACK_COLOR);
    const preferenceTerms = overrideFields.preferenceTerms;
    const preferenceSource = overrideFields.preferenceSource;
    const overrideSource = overrideFields.overrideSource;

    if (override?.primaryColor || override?.palette) {
      const overridePalette = overrideFields.overridePalette;
      return {
        slug,
        sequence,
        name,
        zhName: nullable(row.values.name_zh_hans),
        imagePath,
        primaryColor: overrideFields.overridePrimaryColor ?? overridePalette[0]?.hex ?? DEFAULT_FALLBACK_COLOR,
        palette: overridePalette,
        colorSource: "override",
        fallbackReason: null,
        overrideSource,
        pattern: overrideFields.overridePattern ?? overridePalette.map((color) => color.hex),
        preferenceTerms,
        preferenceSource,
      };
    }

    const result = await extractImagePalette(localImagePath);
    if (result.status === "ok") {
      const palette = result.palette.map((color) => ({ hex: color.hex, percent: color.percent }));
      return {
        slug,
        sequence,
        name,
        zhName: nullable(row.values.name_zh_hans),
        imagePath,
        primaryColor: palette[0]?.hex ?? DEFAULT_FALLBACK_COLOR,
        palette,
        colorSource: "extracted",
        fallbackReason: null,
        overrideSource,
        pattern: overrideFields.overridePattern ?? palette.map((color) => color.hex),
        preferenceTerms,
        preferenceSource,
      };
    }

    return {
      slug,
      sequence,
      name,
      zhName: nullable(row.values.name_zh_hans),
      imagePath,
      primaryColor: DEFAULT_FALLBACK_COLOR,
      palette: [],
      colorSource: "fallback",
      fallbackReason: result.reason,
      overrideSource,
      pattern: overrideFields.overridePattern ?? [],
      preferenceTerms,
      preferenceSource,
    };
  });

  Object.keys(overrides.pokemon).forEach((slug) => {
    if (!seenPokemonSlugs.has(slug)) {
      issues.push({ file: pokemonOverridePath, slug, field: `$.pokemon.${slug}`, message: "Override slug has no matching Pokemon" });
    }
  });

  const sortedRows = pokemonRows.sort(comparePokemon);
  const fallbackCount = sortedRows.filter((pokemon) => pokemon.colorSource === "fallback").length;
  const overrideCount = sortedRows.filter((pokemon) => pokemon.colorSource === "override" || pokemon.overrideSource).length;

  if (sortedRows.length !== expectedPokemonCount) {
    issues.push({
      file: pokemonIndexOutputPath,
      field: "$.summary.pokemonCount",
      message: `Expected ${expectedPokemonCount} Pokemon rows, got ${sortedRows.length}`,
    });
  }

  return {
    schemaVersion: POKEMON_INDEX_SCHEMA_VERSION,
    generatedFrom: {
      pokemonManifestPath,
      overridePath: pokemonOverridePath,
      rawBoundary: "docs/pokopia_image_sources/**",
    },
    summary: {
      pokemonCount: sortedRows.length,
      fallbackCount,
      overrideCount,
    },
    pokemon: sortedRows,
  };
}

function buildRecommendations(
  pokemonIndex: PokemonIndexData,
  compactItems: CompactItemsData,
  itemColors: ItemColorsData,
  overrides: PokemonMetadataOverridesData,
  issues: GenerationIssue[],
): { recommendations: RecommendationsData[]; diagnostics: RecommendationDiagnosticsReport } {
  const result = buildRecommendationDataSet(pokemonIndex.pokemon, compactItems.items, itemColors.items, {
    overrides: overrides.pokemon,
    overridePath: pokemonOverridePath,
  });
  result.issues.forEach((issue) => {
    issues.push({
      file: issue.file ?? recommendationsOutputPath(issue.pokemonSlug),
      slug: issue.itemSlug,
      field: issue.field,
      message: issue.message,
    });
  });
  return { recommendations: result.recommendations, diagnostics: result.diagnostics };
}

function validateAllData(
  compactItems: unknown,
  itemColors: unknown,
  pokemonIndex: unknown,
  overrides: unknown,
  recommendations: unknown[],
  issues: GenerationIssue[],
): void {
  validateCompactItemsData(compactItems).forEach((issue) =>
    issues.push({ file: compactItemsOutputPath, slug: issue.slug, field: issue.path, message: issue.message }),
  );
  validateItemColorsData(itemColors).forEach((issue) =>
    issues.push({ file: itemColorsOutputPath, slug: issue.slug, field: issue.path, message: issue.message }),
  );
  validatePokemonIndexData(pokemonIndex).forEach((issue) =>
    issues.push({ file: pokemonIndexOutputPath, slug: issue.slug, field: issue.path, message: issue.message }),
  );
  validatePokemonMetadataOverridesData(overrides).forEach((issue) =>
    issues.push({ file: pokemonOverridePath, slug: issue.slug, field: issue.path, message: issue.message }),
  );
  recommendations.forEach((recommendation) => {
    const file = isRecord(recommendation) && typeof recommendation.pokemonSlug === "string"
      ? recommendationsOutputPath(recommendation.pokemonSlug)
      : recommendationsOutputDir;
    validateRecommendationsData(recommendation).forEach((issue) =>
      issues.push({ file, slug: issue.slug, field: issue.path, message: issue.message }),
    );
  });

  if (issues.length === 0) {
    validateCompactDataShape(compactItems as CompactItemsData, issues);
    validateItemColorShape(itemColors as ItemColorsData, compactItems as CompactItemsData, issues);
    validatePokemonIndexShape(pokemonIndex as PokemonIndexData, issues);
    validateRecommendationsShape(
      recommendations as RecommendationsData[],
      pokemonIndex as PokemonIndexData,
      compactItems as CompactItemsData,
      itemColors as ItemColorsData,
      issues,
    );
    validateNoPrivatePaths(compactItemsOutputPath, compactItems, issues);
    validateNoPrivatePaths(itemColorsOutputPath, itemColors, issues);
    validateNoPrivatePaths(pokemonIndexOutputPath, pokemonIndex, issues);
    (recommendations as RecommendationsData[]).forEach((recommendation) => {
      validateNoPrivatePaths(recommendationsOutputPath(recommendation.pokemonSlug), recommendation, issues);
    });
  }
}

function validateRecommendationDiagnostics(report: unknown, recommendations: unknown[], issues: GenerationIssue[]): void {
  if (!isRecord(report)) {
    issues.push({ file: recommendationDiagnosticsOutputPath, field: "$", message: "Expected recommendation diagnostics report object" });
    return;
  }

  if (report.schemaVersion !== "recommendation-diagnostics.v1") {
    issues.push({ file: recommendationDiagnosticsOutputPath, field: "$.schemaVersion", message: "Expected recommendation-diagnostics.v1" });
  }
  if (!isRecord(report.summary)) {
    issues.push({ file: recommendationDiagnosticsOutputPath, field: "$.summary", message: "Expected diagnostics summary object" });
  }
  if (!Array.isArray(report.pokemon)) {
    issues.push({ file: recommendationDiagnosticsOutputPath, field: "$.pokemon", message: "Expected diagnostics Pokemon array" });
    return;
  }

  const recommendationCountBySlug = new Map<string, number>();
  recommendations.forEach((data) => {
    if (isRecord(data) && typeof data.pokemonSlug === "string" && Array.isArray(data.recommendations)) {
      recommendationCountBySlug.set(data.pokemonSlug, data.recommendations.length);
    }
  });

  const seenSlugs = new Set<string>();
  let emptyCount = 0;
  let sparseCount = 0;
  let readyCount = 0;
  let totalRecommendations = 0;

  report.pokemon.forEach((entry, index) => {
    const path = `$.pokemon[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ file: recommendationDiagnosticsOutputPath, field: path, message: "Expected Pokemon diagnostics object" });
      return;
    }

    const slug = typeof entry.pokemonSlug === "string" ? entry.pokemonSlug : "";
    if (!slug) {
      issues.push({ file: recommendationDiagnosticsOutputPath, field: `${path}.pokemonSlug`, message: "Expected Pokemon slug" });
      return;
    }
    if (seenSlugs.has(slug)) {
      issues.push({ file: recommendationDiagnosticsOutputPath, slug, field: `${path}.pokemonSlug`, message: "Duplicate Pokemon diagnostics slug" });
    }
    seenSlugs.add(slug);

    const recommendationCount = typeof entry.recommendationCount === "number" ? entry.recommendationCount : -1;
    const expectedRecommendationCount = recommendationCountBySlug.get(slug);
    if (expectedRecommendationCount === undefined) {
      issues.push({ file: recommendationDiagnosticsOutputPath, slug, field: `${path}.pokemonSlug`, message: "Diagnostics slug has no recommendation file" });
    } else if (recommendationCount !== expectedRecommendationCount) {
      issues.push({
        file: recommendationDiagnosticsOutputPath,
        slug,
        field: `${path}.recommendationCount`,
        message: `Expected recommendationCount ${recommendationCount} to match recommendation file count ${expectedRecommendationCount}`,
      });
    }

    const expectedStatus = diagnosticsStatusForCount(recommendationCount);
    if (entry.status !== expectedStatus) {
      issues.push({
        file: recommendationDiagnosticsOutputPath,
        slug,
        field: `${path}.status`,
        message: `Expected diagnostics status ${expectedStatus}`,
      });
    }

    if (!isRecord(entry.exclusionReasonCounts)) {
      issues.push({ file: recommendationDiagnosticsOutputPath, slug, field: `${path}.exclusionReasonCounts`, message: "Expected exclusion reason counts" });
    }
    if (!isRecord(entry.harmonyRejectionReasonCounts)) {
      issues.push({
        file: recommendationDiagnosticsOutputPath,
        slug,
        field: `${path}.harmonyRejectionReasonCounts`,
        message: "Expected harmony rejection reason counts",
      });
    }
    if (!Array.isArray(entry.sampleExcluded)) {
      issues.push({ file: recommendationDiagnosticsOutputPath, slug, field: `${path}.sampleExcluded`, message: "Expected sample excluded array" });
    }
    if (!Array.isArray(entry.sampleRejected)) {
      issues.push({ file: recommendationDiagnosticsOutputPath, slug, field: `${path}.sampleRejected`, message: "Expected sample rejected array" });
    }

    totalRecommendations += Math.max(0, recommendationCount);
    if (entry.status === "empty") emptyCount += 1;
    if (entry.status === "sparse") sparseCount += 1;
    if (entry.status === "ready") readyCount += 1;
  });

  recommendationCountBySlug.forEach((_count, slug) => {
    if (!seenSlugs.has(slug)) {
      issues.push({ file: recommendationDiagnosticsOutputPath, slug, field: "$.pokemon", message: "Missing diagnostics entry for Pokemon" });
    }
  });

  if (isRecord(report.summary)) {
    compareSummaryNumber(report.summary, "pokemonCount", report.pokemon.length, issues);
    compareSummaryNumber(report.summary, "emptyCount", emptyCount, issues);
    compareSummaryNumber(report.summary, "sparseCount", sparseCount, issues);
    compareSummaryNumber(report.summary, "readyCount", readyCount, issues);
    compareSummaryNumber(report.summary, "totalRecommendations", totalRecommendations, issues);
  }

  validateNoPrivatePaths(recommendationDiagnosticsOutputPath, report, issues);
}

function diagnosticsStatusForCount(count: number): "empty" | "sparse" | "ready" {
  if (count === 0) {
    return "empty";
  }
  return count < 3 ? "sparse" : "ready";
}

function compareSummaryNumber(
  summary: Record<string, unknown>,
  key: string,
  expected: number,
  issues: GenerationIssue[],
): void {
  if (summary[key] !== expected) {
    issues.push({
      file: recommendationDiagnosticsOutputPath,
      field: `$.summary.${key}`,
      message: `Expected ${key} ${summary[key]} to equal ${expected}`,
    });
  }
}

function toCompactItem(
  manifestRow: CsvRow,
  placeableRow: CsvRow | undefined,
  rawJson: RawJsonItem | undefined,
  issues: GenerationIssue[],
): CompactItem {
  const row = manifestRow.values;
  const placeable = placeableRow?.values;
  const slug = requireField(row, "slug", itemManifestPath, manifestRow.rowNumber, issues);
  const category = nullable(firstText(row.category, placeable?.category, asString(rawJson?.menu_category)));
  const tags = parseStringArrayField(row.tags, "tags", itemManifestPath, manifestRow.rowNumber, slug, issues);
  const sources = parseStringArrayField(row.sources, "sources", itemManifestPath, manifestRow.rowNumber, slug, issues);
  const habitatItemCategoryIds = parseNumberArrayField(
    row.habitat_item_category_ids,
    "habitat_item_category_ids",
    itemManifestPath,
    manifestRow.rowNumber,
    slug,
    issues,
  );
  const favoriteCategoryIds = parseNumberArrayField(
    row.favorite_category_ids,
    "favorite_category_ids",
    itemManifestPath,
    manifestRow.rowNumber,
    slug,
    issues,
  );

  if (!placeableRow) {
    issues.push({ file: placeableCsvPath, slug, message: "No matching placeable source row found for compact item" });
  }
  if (!rawJson) {
    issues.push({ file: placeableJsonPath, slug, message: "No matching raw JSON source row found for compact item" });
  }

  const sourceIndex = parseNumberField(row.sequence, "sequence", itemManifestPath, manifestRow.rowNumber, slug, issues);

  return {
    slug,
    id: nullable(firstText(row.id, asString(rawJson?.id))),
    name: requireField(row, "name", itemManifestPath, manifestRow.rowNumber, issues, slug),
    nameZh: null,
    category,
    tags,
    event: nullable(row.event),
    sources,
    habitatItemCategoryIds,
    favoriteCategoryIds,
    imagePath: toRootAbsolutePath(requireField(row, "relative_path", itemManifestPath, manifestRow.rowNumber, issues, slug)),
    sourceDataset: nullable(row.source),
    sourceIndex,
    sourceRow: manifestRow.rowNumber,
    recommendation: {
      isDyeable: isDyeableItem(rawJson),
      itemPrimaryColor: null,
      colorSource: null,
      fallbackReason: null,
      preferenceTerms: [],
      roleTags: buildRoleTags(category, tags),
    },
  };
}

function parsePokemonOverrides(text: string, issues: GenerationIssue[]): PokemonMetadataOverridesData {
  const parsed = parseJsonValue(text, pokemonOverridePath, issues);
  const schemaIssues = validatePokemonMetadataOverridesData(parsed);
  schemaIssues.forEach((issue) =>
    issues.push({ file: pokemonOverridePath, slug: issue.slug, field: issue.path, message: issue.message }),
  );
  if (schemaIssues.length > 0) {
    return { schemaVersion: "pokemon-metadata-overrides.v1", pokemon: {} };
  }
  return parsed as PokemonMetadataOverridesData;
}

function isDyeableItem(rawJson: RawJsonItem | undefined): boolean | null {
  if (!rawJson) {
    return null;
  }
  return hasNonEmptyArray(rawJson.color_variants) || hasNonEmptyArray(rawJson.variantSrcs);
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function parsePlaceableJson(text: string, issues: GenerationIssue[]): Map<string, RawJsonItem> {
  const parsed = parseJsonValue(text, placeableJsonPath, issues);
  const bySlug = new Map<string, RawJsonItem>();

  if (!Array.isArray(parsed)) {
    issues.push({ file: placeableJsonPath, message: "Expected top-level JSON array" });
    return bySlug;
  }

  parsed.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({ file: placeableJsonPath, row: index + 1, message: "Expected JSON object item" });
      return;
    }

    const rawItem = item as RawJsonItem;
    const slug = asString(rawItem.slug);
    if (slug) {
      if (bySlug.has(slug)) {
        issues.push({ file: placeableJsonPath, row: index + 1, slug, message: "Duplicate slug in raw JSON" });
        return;
      }
      bySlug.set(slug, rawItem);
    }
  });

  return bySlug;
}

function validateCompactDataShape(data: CompactItemsData, issues: GenerationIssue[]): void {
  const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
  if (gzipBytes >= maxCompactItemsGzipBytes) {
    issues.push({
      file: compactItemsOutputPath,
      field: "$",
      message: `Expected gzip size below ${maxCompactItemsGzipBytes} bytes, got ${gzipBytes}`,
    });
  }

  data.items.forEach((item) => {
    if (item.recommendation.isDyeable === null) {
      issues.push({ file: compactItemsOutputPath, slug: item.slug, field: "$.recommendation.isDyeable", message: "Expected derived dyeable status" });
    }
    validateRootAbsoluteImagePath(
      item.imagePath,
      localItemImageRoot,
      "/docs/pokopia_image_sources/item_portraits/",
      compactItemsOutputPath,
      item.slug,
      issues,
    );
  });
}

function validateItemColorShape(data: ItemColorsData, compactItems: CompactItemsData, issues: GenerationIssue[]): void {
  const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
  if (gzipBytes >= maxItemColorsGzipBytes) {
    issues.push({
      file: itemColorsOutputPath,
      field: "$",
      message: `Expected gzip size below ${maxItemColorsGzipBytes} bytes, got ${gzipBytes}`,
    });
  }
  if (data.items.length !== expectedItemCount) {
    issues.push({
      file: itemColorsOutputPath,
      field: "$.summary.itemCount",
      message: `Expected ${expectedItemCount} item color rows, got ${data.items.length}`,
    });
  }
  if (data.items.length !== compactItems.items.length) {
    issues.push({
      file: itemColorsOutputPath,
      field: "$.items",
      message: `Expected ${compactItems.items.length} item color rows, got ${data.items.length}`,
    });
  }

  const compactSlugs = new Set(compactItems.items.map((item) => item.slug));
  data.items.forEach((item) => {
    if (!compactSlugs.has(item.slug)) {
      issues.push({ file: itemColorsOutputPath, slug: item.slug, field: "$.items[].slug", message: "Item color has no compact item" });
    }
  });
}

function validatePokemonIndexShape(data: PokemonIndexData, issues: GenerationIssue[]): void {
  const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
  if (gzipBytes >= maxPokemonIndexGzipBytes) {
    issues.push({
      file: pokemonIndexOutputPath,
      field: "$",
      message: `Expected gzip size below ${maxPokemonIndexGzipBytes} bytes, got ${gzipBytes}`,
    });
  }
  data.pokemon.forEach((pokemon) => {
    validateRootAbsoluteImagePath(
      pokemon.imagePath,
      localPokemonImageRoot,
      "/docs/pokopia_image_sources/pokemon_portraits/",
      pokemonIndexOutputPath,
      pokemon.slug,
      issues,
    );
  });
}

function validateRecommendationsShape(
  recommendations: RecommendationsData[],
  pokemonIndex: PokemonIndexData,
  compactItems: CompactItemsData,
  itemColors: ItemColorsData,
  issues: GenerationIssue[],
): void {
  const expectedPokemonSlugs = new Set(pokemonIndex.pokemon.map((pokemon) => pokemon.slug));
  const compactBySlug = new Map(compactItems.items.map((item) => [item.slug, item]));
  const itemColorsBySlug = new Map(itemColors.items.map((item) => [item.slug, item.itemPrimaryColor]));
  const seenPokemonSlugs = new Set<string>();

  if (recommendations.length !== expectedPokemonSlugs.size) {
    issues.push({
      file: recommendationsOutputDir,
      field: "$",
      message: `Expected ${expectedPokemonSlugs.size} recommendation files, got ${recommendations.length}`,
    });
  }

  recommendations.forEach((data) => {
    const file = recommendationsOutputPath(data.pokemonSlug);
    const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
    if (gzipBytes >= maxRecommendationGzipBytes) {
      issues.push({
        file,
        field: "$",
        message: `Expected gzip size below ${maxRecommendationGzipBytes} bytes, got ${gzipBytes}`,
      });
    }

    if (!expectedPokemonSlugs.has(data.pokemonSlug)) {
      issues.push({ file, slug: data.pokemonSlug, field: "$.pokemonSlug", message: "Recommendation file has no matching Pokemon" });
    }
    if (seenPokemonSlugs.has(data.pokemonSlug)) {
      issues.push({ file, slug: data.pokemonSlug, field: "$.pokemonSlug", message: "Duplicate Pokemon recommendation file" });
    }
    seenPokemonSlugs.add(data.pokemonSlug);

    data.recommendations.forEach((entry) => {
      const item = compactBySlug.get(entry.itemSlug);
      if (!item) {
        issues.push({ file, slug: entry.itemSlug, field: "$.recommendations[].itemSlug", message: "Recommendation item missing from compact data" });
        return;
      }
      if (entry.itemName !== item.name) {
        issues.push({ file, slug: entry.itemSlug, field: "$.recommendations[].itemName", message: "Recommendation item name differs from compact data" });
      }
      if (entry.itemZhName !== item.nameZh) {
        issues.push({ file, slug: entry.itemSlug, field: "$.recommendations[].itemZhName", message: "Recommendation item zhName differs from compact data" });
      }
      if (entry.itemImagePath !== item.imagePath) {
        issues.push({ file, slug: entry.itemSlug, field: "$.recommendations[].itemImagePath", message: "Recommendation item image differs from compact data" });
      }
      validateRootAbsoluteImagePath(
        entry.itemImagePath,
        localItemImageRoot,
        "/docs/pokopia_image_sources/item_portraits/",
        file,
        entry.itemSlug,
        issues,
      );

      const expectedItemPrimaryColor = itemColorsBySlug.get(entry.itemSlug);
      if (itemColorsBySlug.has(entry.itemSlug) && entry.itemPrimaryColor !== expectedItemPrimaryColor) {
        issues.push({
          file,
          slug: entry.itemSlug,
          field: "$.recommendations[].itemPrimaryColor",
          message: "Recommendation item primary color differs from item color data",
        });
      }
    });
  });

  expectedPokemonSlugs.forEach((slug) => {
    if (!seenPokemonSlugs.has(slug)) {
      issues.push({ file: recommendationsOutputPath(slug), slug, field: "$.pokemonSlug", message: "Missing recommendation file for Pokemon" });
    }
  });
}

function validateRecommendationOutputPaths(
  files: Array<{ path: string; text: string }>,
  recommendations: unknown[],
  issues: GenerationIssue[],
): void {
  files.forEach((file, index) => {
    const recommendation = recommendations[index];
    if (!isRecord(recommendation) || typeof recommendation.pokemonSlug !== "string") {
      return;
    }

    const expectedSlug = basename(file.path, ".json");
    if (recommendation.pokemonSlug !== expectedSlug) {
      issues.push({
        file: file.path,
        slug: recommendation.pokemonSlug,
        field: "$.pokemonSlug",
        message: `Expected pokemonSlug to match file name ${expectedSlug}`,
      });
    }
  });
}

function validateRootAbsoluteImagePath(
  imagePath: string,
  localRoot: string,
  expectedPrefix: string,
  file: string,
  slug: string,
  issues: GenerationIssue[],
): void {
  if (!imagePath.startsWith(expectedPrefix)) {
    issues.push({ file, slug, field: "$.imagePath", message: `Expected root-absolute image path under ${expectedPrefix}` });
  }

  const localImagePath = resolve(projectRoot, imagePath.slice(1));
  const rootRelativeImagePath = relative(localRoot, localImagePath);
  if (rootRelativeImagePath.startsWith("..") || isAbsolute(rootRelativeImagePath)) {
    issues.push({ file, slug, field: "$.imagePath", message: "Referenced image path escapes expected image root" });
  }
  if (!existsSync(localImagePath)) {
    issues.push({ file, slug, field: "$.imagePath", message: `Referenced image file does not exist: ${imagePath}` });
  }
}

function validateNoPrivatePaths(file: string, data: unknown, issues: GenerationIssue[]): void {
  const serialized = JSON.stringify(data);
  if (serialized.includes(projectRoot) || serialized.includes("/Users/")) {
    issues.push({ file, field: "$", message: "Generated data contains local absolute path" });
  }
}

function indexCsvRowsBySlug(rows: CsvRow[], file: string, issues: GenerationIssue[]): Map<string, CsvRow> {
  const bySlug = new Map<string, CsvRow>();
  rows.forEach((row) => {
    const slug = row.values.slug.trim();
    if (!slug) {
      return;
    }
    if (bySlug.has(slug)) {
      issues.push({ file, row: row.rowNumber, slug, message: "Duplicate slug in CSV source" });
      return;
    }
    bySlug.set(slug, row);
  });
  return bySlug;
}

function parseStringArrayField(
  value: string,
  field: string,
  file: string,
  row: number,
  slug: string,
  issues: GenerationIssue[],
): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return uniqueSorted(parsed.map((item) => item.trim()).filter(Boolean));
    }
  } catch {
    // Issue is reported below with field and row context.
  }

  issues.push({ file, row, slug, field, message: "Expected JSON string array" });
  return [];
}

function parseNumberArrayField(
  value: string,
  field: string,
  file: string,
  row: number,
  slug: string,
  issues: GenerationIssue[],
): number[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "number" && Number.isFinite(item))) {
      return parsed.slice().sort((left, right) => left - right);
    }
  } catch {
    // Issue is reported below with field and row context.
  }

  issues.push({ file, row, slug, field, message: "Expected JSON number array" });
  return [];
}

function requireField(
  row: Record<string, string>,
  field: string,
  file: string,
  rowNumber: number,
  issues: GenerationIssue[],
  slug?: string,
): string {
  const value = row[field]?.trim();
  if (!value) {
    issues.push({ file, row: rowNumber, slug, field, message: "Required field is empty" });
  }
  return value ?? "";
}

function parseNumberField(
  value: string | undefined,
  field: string,
  file: string,
  row: number,
  slug: string,
  issues: GenerationIssue[],
): number | null {
  const normalized = value?.trim();
  if (!normalized) {
    issues.push({ file, row, slug, field, message: "Required number field is empty" });
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    issues.push({ file, row, slug, field, message: "Expected finite number" });
    return null;
  }
  return parsed;
}

function parseJsonValue(text: string, file: string, issues: GenerationIssue[]): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    issues.push({ file, field: "$", message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` });
    return null;
  }
}

async function mapWithConcurrency<T, U>(items: T[], concurrency: number, work: (item: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await work(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

function nullable(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function firstText(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value?.trim());
}

function toRootAbsolutePath(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return String(value);
}

function slugify(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pokemonSlug(row: Record<string, string>, name: string): string {
  const explicitSlug = row.slug?.trim();
  if (explicitSlug) {
    return explicitSlug;
  }
  const filenameSlug = row.filename?.trim().replace(/\.[^.]+$/, "").replace(/^\d+-/, "");
  return filenameSlug || slugify(name);
}

function buildRoleTags(category: string | null, tags: string[]): string[] {
  return uniqueSorted([category, ...tags].filter((value): value is string => Boolean(value)).map(toRoleTag));
}

function toRoleTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, "en"));
}

function compareCompactItems(left: CompactItem, right: CompactItem): number {
  return (
    (left.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (right.sourceIndex ?? Number.MAX_SAFE_INTEGER) ||
    left.slug.localeCompare(right.slug, "en")
  );
}

function comparePokemon(left: PokemonIndexEntry, right: PokemonIndexEntry): number {
  return Number(left.sequence) - Number(right.sequence) || left.slug.localeCompare(right.slug, "en");
}

function countBy(items: CompactItem[], select: (item: CompactItem) => string): Record<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return sortedRecord(counts);
}

function countTags(items: CompactItem[]): Record<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    item.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return sortedRecord(counts);
}

function sortedRecord(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function serializeJsonForOutput(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function recommendationsOutputPath(slug: string): string {
  return `${recommendationsOutputDir}/${slug}.json`;
}

function largestGzipRecommendation(recommendations: RecommendationsData[]): { pokemonSlug: string; gzipBytes: number } {
  return recommendations.reduce(
    (largest, data) => {
      const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
      return gzipBytes > largest.gzipBytes ? { pokemonSlug: data.pokemonSlug, gzipBytes } : largest;
    },
    { pokemonSlug: "none", gzipBytes: 0 },
  );
}

async function readRecommendationOutputFiles(issues: GenerationIssue[]): Promise<Array<{ path: string; text: string }>> {
  let names: string[];
  try {
    names = await readdir(absoluteRecommendationsOutputDir);
  } catch (error) {
    issues.push({
      file: recommendationsOutputDir,
      message: `Unable to read recommendation directory: ${error instanceof Error ? error.message : String(error)}`,
    });
    return [];
  }

  const jsonNames = names.filter((name) => name.endsWith(".json")).sort((left, right) => left.localeCompare(right, "en"));
  return Promise.all(
    jsonNames.map(async (name) => ({
      path: `${recommendationsOutputDir}/${name}`,
      text: await readFile(resolve(absoluteRecommendationsOutputDir, name), "utf8"),
    })),
  );
}

function printIssues(title: string, issues: GenerationIssue[]): void {
  console.error(title);
  issues.forEach((issue) => {
    const location = [issue.file, issue.row ? `row ${issue.row}` : undefined, issue.slug, issue.field]
      .filter(Boolean)
      .join(" ");
    console.error(`- ${location}: ${issue.message}`);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
