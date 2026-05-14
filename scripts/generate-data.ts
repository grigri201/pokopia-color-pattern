import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
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
import {
  buildRecommendationDataSet,
  type RecommendationBuildCompactItem,
  type RecommendationDiagnosticsReport,
} from "../src/domain/recommendation-data.js";
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

type PokemonPreferenceSourceData = {
  schemaVersion?: unknown;
  pokemon?: unknown;
  itemPreferenceTerms?: unknown;
};

type PokemonPreferenceSourceEntry = {
  slug: string;
  preferenceTerms: string[];
};

type ItemPreferenceSourceEntry = {
  slug: string;
  terms: string[];
};

type ItemTranslationSource = {
  bySlug: Map<string, string>;
  byName: Map<string, string>;
};

type RuntimeAssetSourceCategory = "pokemon" | "item";

type RuntimeAssetSourceEntry = {
  slug: string;
  sourceCategory: RuntimeAssetSourceCategory;
  sourcePath: string;
  runtimePath: string;
};

type RuntimeAssetSourcesData = {
  schemaVersion: "runtime-asset-sources.v1";
  generatedFrom: {
    compactItemsPath: string;
    pokemonIndexPath: string;
    recommendationDataDir: string;
    rawBoundary: string;
  };
  summary: {
    assetCount: number;
    pokemonCount: number;
    itemCount: number;
  };
  assets: RuntimeAssetSourceEntry[];
};

type CompactItemsBuildResult = {
  data: CompactItemsData;
  recommendationItems: RecommendationBuildCompactItem[];
  assetSources: RuntimeAssetSourceEntry[];
};

type PokemonIndexBuildResult = {
  data: PokemonIndexData;
  assetSources: RuntimeAssetSourceEntry[];
};

type CompactItemBuildResult = {
  item: CompactItem;
  recommendationItem: RecommendationBuildCompactItem;
  assetSource: RuntimeAssetSourceEntry;
  sortIndex: number | null;
};

const projectRoot = process.cwd();

const itemManifestPath = "docs/pokopia_image_sources/item_portraits/manifest.csv";
const placeableCsvPath = "docs/pokopia_image_sources/pokopiadex_placeable_items.csv";
const placeableJsonPath = "docs/pokopia_image_sources/pokopiadex_placeable_items.json";
const itemTranslationCsvPaths = [
  "docs/pokopia_image_sources/infipoke_items_zh_hans.csv",
  "docs/pokopia_image_sources/decorative_item_images.csv",
  "docs/pokopia_image_sources/item_furniture_images.csv",
] as const;
const pokemonManifestPath = "docs/pokopia_image_sources/pokemon_portraits/manifest.csv";
const pokemonPreferencePath = "docs/pokopia_image_sources/pokopiadex_pokemon_preferences.json";
const pokemonOverridePath = "data/overrides/pokemon-metadata.json";

const compactItemsOutputPath = "generated/data/compact-items.json";
const itemColorsOutputPath = "generated/data/item-colors.json";
const pokemonIndexOutputPath = "generated/data/pokemon-index.json";
const recommendationsOutputDir = "generated/data/recommendations";
const recommendationDiagnosticsOutputPath = "generated/reports/recommendation-diagnostics.json";
const runtimeAssetSourcesOutputPath = "generated/reports/runtime-asset-sources.json";

const maxCompactItemsGzipBytes = 50 * 1024;
const maxItemColorsGzipBytes = 25 * 1024;
const maxPokemonIndexGzipBytes = 40 * 1024;
const maxRecommendationGzipBytes = 5 * 1024;
const recommendationPageSize = 10;
const expectedItemCount = 1219;
const expectedPokemonCount = 311;
const pokemonAllowedWithoutPreferenceTerms = new Set(["ditto"]);

const absoluteItemManifestPath = resolve(projectRoot, itemManifestPath);
const absolutePlaceableCsvPath = resolve(projectRoot, placeableCsvPath);
const absolutePlaceableJsonPath = resolve(projectRoot, placeableJsonPath);
const absoluteItemTranslationCsvPaths = itemTranslationCsvPaths.map((path) => resolve(projectRoot, path));
const absolutePokemonManifestPath = resolve(projectRoot, pokemonManifestPath);
const absolutePokemonPreferencePath = resolve(projectRoot, pokemonPreferencePath);
const absolutePokemonOverridePath = resolve(projectRoot, pokemonOverridePath);
const absoluteCompactItemsOutputPath = resolve(projectRoot, compactItemsOutputPath);
const absoluteItemColorsOutputPath = resolve(projectRoot, itemColorsOutputPath);
const absolutePokemonIndexOutputPath = resolve(projectRoot, pokemonIndexOutputPath);
const absoluteRecommendationsOutputDir = resolve(projectRoot, recommendationsOutputDir);
const absoluteRecommendationDiagnosticsOutputPath = resolve(projectRoot, recommendationDiagnosticsOutputPath);
const absoluteRuntimeAssetSourcesOutputPath = resolve(projectRoot, runtimeAssetSourcesOutputPath);

const validateOnly = process.argv.includes("--validate-only");

if (validateOnly) {
  await validateExistingOutputs();
} else {
  await generateData();
}

async function generateData(): Promise<void> {
  const issues: GenerationIssue[] = [];
  const [manifestCsv, placeableCsv, placeableJsonText, pokemonCsv, pokemonPreferenceText, overrideText] = await Promise.all([
    readFile(absoluteItemManifestPath, "utf8"),
    readFile(absolutePlaceableCsvPath, "utf8"),
    readFile(absolutePlaceableJsonPath, "utf8"),
    readFile(absolutePokemonManifestPath, "utf8"),
    readFile(absolutePokemonPreferencePath, "utf8"),
    readFile(absolutePokemonOverridePath, "utf8"),
  ]);
  const itemTranslationCsvs = await Promise.all(absoluteItemTranslationCsvPaths.map((path) => readFile(path, "utf8")));

  const overrides = parsePokemonOverrides(overrideText, issues);
  const pokemonPreferenceSource = parsePokemonPreferenceSource(pokemonPreferenceText, issues);
  const itemTranslationSource = parseItemTranslationSource(itemTranslationCsvs, issues);
  const compactItemsBuild = buildCompactItems(
    manifestCsv,
    placeableCsv,
    placeableJsonText,
    pokemonPreferenceSource.itemTermsBySlug,
    itemTranslationSource,
    issues,
  );
  const compactItems = compactItemsBuild.data;
  const itemSourceBySlug = new Map(compactItemsBuild.assetSources.map((asset) => [asset.slug, asset]));
  const itemColors = await buildItemColors(compactItems.items, itemSourceBySlug, issues);
  applyItemColorsToCompactItems(compactItems, itemColors);
  const pokemonIndexBuild = await buildPokemonIndex(pokemonCsv, pokemonPreferenceSource.pokemonTermsBySlug, overrides, issues);
  const pokemonIndex = pokemonIndexBuild.data;
  const recommendationBuild = buildRecommendations(pokemonIndex, compactItemsBuild.recommendationItems, itemColors, overrides, issues);
  const recommendations = recommendationBuild.recommendations;
  const recommendationDiagnostics = recommendationBuild.diagnostics;
  const runtimeAssetSources = buildRuntimeAssetSources(
    pokemonIndexBuild.assetSources,
    compactItemsBuild.assetSources,
    compactItems,
    recommendations,
    issues,
  );

  validateAllData(compactItems, itemColors, pokemonIndex, overrides, recommendations, issues);
  validateRecommendationSourceCoverage(pokemonPreferenceSource, issues);
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
    writeJsonFile(absoluteRuntimeAssetSourcesOutputPath, runtimeAssetSources),
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
  console.log(`Generated ${runtimeAssetSourcesOutputPath} with ${runtimeAssetSources.assets.length} runtime asset source rows.`);
}

async function validateExistingOutputs(): Promise<void> {
  const issues: GenerationIssue[] = [];
  const [compactText, itemColorsText, pokemonIndexText, pokemonPreferenceText, overrideText, recommendationDiagnosticsText, runtimeAssetSourcesText, recommendationFiles] = await Promise.all([
    readFile(absoluteCompactItemsOutputPath, "utf8"),
    readFile(absoluteItemColorsOutputPath, "utf8"),
    readFile(absolutePokemonIndexOutputPath, "utf8"),
    readFile(absolutePokemonPreferencePath, "utf8"),
    readFile(absolutePokemonOverridePath, "utf8"),
    readFile(absoluteRecommendationDiagnosticsOutputPath, "utf8"),
    readFile(absoluteRuntimeAssetSourcesOutputPath, "utf8"),
    readRecommendationOutputFiles(issues),
  ]);

  const compactItems = parseJsonValue(compactText, compactItemsOutputPath, issues);
  const itemColors = parseJsonValue(itemColorsText, itemColorsOutputPath, issues);
  const pokemonIndex = parseJsonValue(pokemonIndexText, pokemonIndexOutputPath, issues);
  const pokemonPreferenceSource = parsePokemonPreferenceSource(pokemonPreferenceText, issues);
  const overrides = parseJsonValue(overrideText, pokemonOverridePath, issues);
  const recommendationDiagnostics = parseJsonValue(recommendationDiagnosticsText, recommendationDiagnosticsOutputPath, issues);
  const runtimeAssetSources = parseJsonValue(runtimeAssetSourcesText, runtimeAssetSourcesOutputPath, issues);
  const recommendations = recommendationFiles.map((file) => parseJsonValue(file.text, file.path, issues));
  validateRecommendationOutputPaths(recommendationFiles, recommendations, issues);

  validateAllData(compactItems, itemColors, pokemonIndex, overrides, recommendations, issues);
  validateRecommendationSourceCoverage(pokemonPreferenceSource, issues);
  validateRecommendationDiagnostics(recommendationDiagnostics, recommendations, issues);
  validateRuntimeAssetSources(runtimeAssetSources, compactItems, pokemonIndex, recommendations, issues);

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
    `Validated ${compactItemsOutputPath} (${compactCount}), ${itemColorsOutputPath} (${itemColorCount}), ${pokemonIndexOutputPath} (${pokemonCount}), ${runtimeAssetSourcesOutputPath}, and ${recommendations.length} recommendation files.`,
  );
}

function buildCompactItems(
  manifestCsv: string,
  placeableCsv: string,
  placeableJsonText: string,
  itemPreferenceTermsBySlug: Map<string, string[]>,
  itemTranslationSource: ItemTranslationSource,
  issues: GenerationIssue[],
): CompactItemsBuildResult {
  const manifest = parseCsv(manifestCsv);
  const placeable = parseCsv(placeableCsv);
  manifest.issues.forEach((message) => issues.push({ file: itemManifestPath, message }));
  placeable.issues.forEach((message) => issues.push({ file: placeableCsvPath, message }));

  const placeableBySlug = indexCsvRowsBySlug(placeable.rows, placeableCsvPath, issues);
  const rawJsonBySlug = parsePlaceableJson(placeableJsonText, issues);
  const compactBuildRows = manifest.rows
    .filter((row) => row.values.status === "ok" && row.values.kind === "placeable_item")
    .map((row) =>
      toCompactItem(
        row,
        placeableBySlug.get(row.values.slug),
        rawJsonBySlug.get(row.values.slug),
        itemPreferenceTermsBySlug.get(row.values.slug) ?? [],
        itemTranslationSource,
        issues,
      ),
    )
    .sort(compareCompactBuildRows);

  return {
    data: {
      schemaVersion: COMPACT_ITEMS_SCHEMA_VERSION,
      summary: {
        itemCount: compactBuildRows.length,
        categoryCounts: countBy(compactBuildRows.map((row) => row.item), (item) => item.category ?? "Uncategorized"),
        tagCounts: countTags(compactBuildRows.map((row) => row.item)),
      },
      items: compactBuildRows.map((row) => row.item),
    },
    recommendationItems: compactBuildRows.map((row) => row.recommendationItem),
    assetSources: compactBuildRows.map((row) => row.assetSource),
  };
}

function parseItemTranslationSource(csvTexts: string[], issues: GenerationIssue[]): ItemTranslationSource {
  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();

  csvTexts.forEach((text, index) => {
    const file = itemTranslationCsvPaths[index] ?? "item translation source";
    const parsed = parseCsv(text);
    parsed.issues.forEach((message) => issues.push({ file, message }));
    parsed.rows.forEach((row) => {
      const zhName = nullable(row.values.name_zh_hans);
      if (!zhName) {
        return;
      }

      const slug = nullable(firstText(row.values.slug, row.values.pokopiadex_slug, row.values.infipoke_slug));
      const name = nullable(row.values.name);
      if (slug) {
        setFirstTranslation(bySlug, itemSlugTranslationKey(slug), zhName);
      }
      if (name) {
        setFirstTranslation(byName, itemNameTranslationKey(name), zhName);
      }
    });
  });

  return { bySlug, byName };
}

function setFirstTranslation(map: Map<string, string>, key: string, value: string): void {
  if (key && !map.has(key)) {
    map.set(key, value);
  }
}

function resolveItemTranslation(source: ItemTranslationSource, slug: string, name: string): string | null {
  return (
    source.bySlug.get(itemSlugTranslationKey(slug)) ??
    source.byName.get(itemNameTranslationKey(name)) ??
    source.byName.get(itemNameTranslationKey(name.replace(/\s+\(interior\)$/i, " (wallpaper)"))) ??
    null
  );
}

function itemSlugTranslationKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function itemNameTranslationKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function buildItemColors(
  items: CompactItem[],
  itemSourceBySlug: Map<string, RuntimeAssetSourceEntry>,
  issues: GenerationIssue[],
): Promise<ItemColorsData> {
  const colorRows = await mapWithConcurrency(items, 12, async (item): Promise<ItemColorEntry> => {
    const source = itemSourceBySlug.get(item.slug);
    const imagePath = source ? resolve(projectRoot, source.sourcePath) : resolve(projectRoot, item.imagePath.slice(1));
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

function applyItemColorsToCompactItems(compactItems: CompactItemsData, itemColors: ItemColorsData): void {
  const itemColorBySlug = new Map(itemColors.items.map((item) => [item.slug, item]));
  compactItems.items.forEach((item) => {
    const color = itemColorBySlug.get(item.slug);
    if (!color) {
      return;
    }
    item.recommendation.itemPrimaryColor = color.itemPrimaryColor;
  });
}

async function buildPokemonIndex(
  pokemonCsv: string,
  pokemonPreferenceTermsBySlug: Map<string, string[]>,
  overrides: PokemonMetadataOverridesData,
  issues: GenerationIssue[],
): Promise<PokemonIndexBuildResult> {
  const manifest = parseCsv(pokemonCsv);
  manifest.issues.forEach((message) => issues.push({ file: pokemonManifestPath, message }));
  const rows = manifest.rows.filter((row) => row.values.status === "ok" && row.values.kind === "pokemon");
  const seenPokemonSlugs = new Set<string>();

  const pokemonRows = await mapWithConcurrency(rows, 12, async (row): Promise<{ pokemon: PokemonIndexEntry; assetSource: RuntimeAssetSourceEntry }> => {
    const name = requireField(row.values, "name", pokemonManifestPath, row.rowNumber, issues);
    const slug = pokemonSlug(row.values, name);
    seenPokemonSlugs.add(slug);
    const override = overrides.pokemon[slug];
    const sequence = requireField(row.values, "sequence", pokemonManifestPath, row.rowNumber, issues, slug);
    if (!/^\d+$/.test(sequence)) {
      issues.push({ file: pokemonManifestPath, row: row.rowNumber, slug, field: "sequence", message: "Expected numeric sequence" });
    }
    const sourceImagePath = toRootAbsolutePath(requireField(row.values, "relative_path", pokemonManifestPath, row.rowNumber, issues, slug));
    const runtimeImagePath = runtimeAssetPath("pokemon", slug, sourceImagePath);
    const assetSource = runtimeAssetSource("pokemon", slug, sourceImagePath, runtimeImagePath);
    const localImagePath = resolve(projectRoot, sourceImagePath.slice(1));
    const overrideFields = resolvePokemonMetadataOverrideFields(slug, override, pokemonOverridePath, DEFAULT_FALLBACK_COLOR);
    const metadataPreferenceTerms = pokemonPreferenceTermsBySlug.get(slug) ?? [];
    const preferenceTerms = uniqueSorted([...metadataPreferenceTerms, ...overrideFields.preferenceTerms].map(toPreferenceTerm).filter(Boolean));
    const preferenceSource = overrideFields.preferenceSource ?? (metadataPreferenceTerms.length > 0 ? "metadata" : null);
    const overrideSource = overrideFields.overrideSource;

    if (override?.primaryColor || override?.palette) {
      const overridePalette = overrideFields.overridePalette;
      return {
        pokemon: {
          slug,
          sequence,
          name,
          zhName: nullable(row.values.name_zh_hans),
          imagePath: runtimeImagePath,
          primaryColor: overrideFields.overridePrimaryColor ?? overridePalette[0]?.hex ?? DEFAULT_FALLBACK_COLOR,
          palette: overridePalette,
          colorSource: "override",
          fallbackReason: null,
          overrideSource,
          pattern: overrideFields.overridePattern ?? overridePalette.map((color) => color.hex),
          preferenceTerms,
          preferenceSource,
        },
        assetSource,
      };
    }

    const result = await extractImagePalette(localImagePath);
    if (result.status === "ok") {
      const palette = result.palette.map((color) => ({ hex: color.hex, percent: color.percent }));
      return {
        pokemon: {
          slug,
          sequence,
          name,
          zhName: nullable(row.values.name_zh_hans),
          imagePath: runtimeImagePath,
          primaryColor: palette[0]?.hex ?? DEFAULT_FALLBACK_COLOR,
          palette,
          colorSource: "extracted",
          fallbackReason: null,
          overrideSource,
          pattern: overrideFields.overridePattern ?? palette.map((color) => color.hex),
          preferenceTerms,
          preferenceSource,
        },
        assetSource,
      };
    }

    return {
      pokemon: {
        slug,
        sequence,
        name,
        zhName: nullable(row.values.name_zh_hans),
        imagePath: runtimeImagePath,
        primaryColor: DEFAULT_FALLBACK_COLOR,
        palette: [],
        colorSource: "fallback",
        fallbackReason: result.reason,
        overrideSource,
        pattern: overrideFields.overridePattern ?? [],
        preferenceTerms,
        preferenceSource,
      },
      assetSource,
    };
  });

  Object.keys(overrides.pokemon).forEach((slug) => {
    if (!seenPokemonSlugs.has(slug)) {
      issues.push({ file: pokemonOverridePath, slug, field: `$.pokemon.${slug}`, message: "Override slug has no matching Pokemon" });
    }
  });

  const sortedRows = pokemonRows.sort((left, right) => comparePokemon(left.pokemon, right.pokemon));
  const sortedPokemon = sortedRows.map((row) => row.pokemon);
  const fallbackCount = sortedPokemon.filter((pokemon) => pokemon.colorSource === "fallback").length;
  const overrideCount = sortedPokemon.filter((pokemon) => pokemon.colorSource === "override" || pokemon.overrideSource).length;

  if (sortedPokemon.length !== expectedPokemonCount) {
    issues.push({
      file: pokemonIndexOutputPath,
      field: "$.summary.pokemonCount",
      message: `Expected ${expectedPokemonCount} Pokemon rows, got ${sortedPokemon.length}`,
    });
  }

  return {
    data: {
      schemaVersion: POKEMON_INDEX_SCHEMA_VERSION,
      summary: {
        pokemonCount: sortedPokemon.length,
        fallbackCount,
        overrideCount,
      },
      pokemon: sortedPokemon,
    },
    assetSources: sortedRows.map((row) => row.assetSource),
  };
}

function buildRecommendations(
  pokemonIndex: PokemonIndexData,
  recommendationItems: RecommendationBuildCompactItem[],
  itemColors: ItemColorsData,
  overrides: PokemonMetadataOverridesData,
  issues: GenerationIssue[],
): { recommendations: RecommendationsData[]; diagnostics: RecommendationDiagnosticsReport } {
  const result = buildRecommendationDataSet(pokemonIndex.pokemon, recommendationItems, itemColors.items, {
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
  if (report.pokemon.length > 0 && totalRecommendations === 0) {
    issues.push({
      file: recommendationDiagnosticsOutputPath,
      field: "$.summary.totalRecommendations",
      message: "Expected generated recommendations to contain at least one item",
    });
  }

  validateNoPrivatePaths(recommendationDiagnosticsOutputPath, report, issues);
}

function validateRuntimeAssetSources(
  report: unknown,
  compactItems: unknown,
  pokemonIndex: unknown,
  recommendations: unknown[],
  issues: GenerationIssue[],
): void {
  if (!isRecord(report)) {
    issues.push({ file: runtimeAssetSourcesOutputPath, field: "$", message: "Expected runtime asset source report object" });
    return;
  }
  if (report.schemaVersion !== "runtime-asset-sources.v1") {
    issues.push({ file: runtimeAssetSourcesOutputPath, field: "$.schemaVersion", message: "Expected runtime-asset-sources.v1" });
  }
  if (!Array.isArray(report.assets)) {
    issues.push({ file: runtimeAssetSourcesOutputPath, field: "$.assets", message: "Expected runtime asset source array" });
    return;
  }

  const expectedPokemonSlugs = isRecord(pokemonIndex) && Array.isArray(pokemonIndex.pokemon)
    ? new Set(
        pokemonIndex.pokemon
          .filter(isRecord)
          .map((pokemon) => pokemon.slug)
          .filter((slug): slug is string => typeof slug === "string"),
      )
    : new Set<string>();
  const expectedItemSlugs = isRecord(compactItems) && Array.isArray(compactItems.items)
    ? new Set(
        compactItems.items
          .filter(isRecord)
          .map((item) => item.slug)
          .filter((slug): slug is string => typeof slug === "string"),
      )
    : new Set<string>();
  const recommendedItemSlugs = new Set<string>();
  recommendations.forEach((recommendation) => {
    if (!isRecord(recommendation) || !Array.isArray(recommendation.recommendations)) {
      return;
    }
    recommendation.recommendations.filter(isRecord).forEach((entry) => {
      if (typeof entry.itemSlug === "string") {
        recommendedItemSlugs.add(entry.itemSlug);
      }
    });
  });

  const seen = new Set<string>();
  const seenPokemon = new Set<string>();
  const seenItems = new Set<string>();
  report.assets.forEach((asset, index) => {
    const path = `$.assets[${index}]`;
    if (!isRecord(asset)) {
      issues.push({ file: runtimeAssetSourcesOutputPath, field: path, message: "Expected runtime asset source object" });
      return;
    }
    const slug = typeof asset.slug === "string" ? asset.slug : "";
    const sourceCategory = asset.sourceCategory;
    const sourcePath = typeof asset.sourcePath === "string" ? asset.sourcePath : "";
    const runtimePath = typeof asset.runtimePath === "string" ? asset.runtimePath : "";
    if (!slug) {
      issues.push({ file: runtimeAssetSourcesOutputPath, field: `${path}.slug`, message: "Expected slug" });
    }
    if (sourceCategory !== "pokemon" && sourceCategory !== "item") {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: `${path}.sourceCategory`, message: "Expected pokemon or item" });
    }
    if (!sourcePath.startsWith("docs/pokopia_image_sources/") || sourcePath.includes("..") || sourcePath.includes("\\")) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: `${path}.sourcePath`, message: "Expected normalized docs source path" });
    } else if (!existsSync(resolve(projectRoot, sourcePath))) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: `${path}.sourcePath`, message: "Runtime asset source file does not exist" });
    }
    const expectedPrefix = sourceCategory === "pokemon" ? "/assets/runtime/pokemon/" : "/assets/runtime/items/";
    if (!runtimePath.startsWith(expectedPrefix) || runtimePath.includes("..") || runtimePath.includes("\\")) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: `${path}.runtimePath`, message: `Expected runtime path under ${expectedPrefix}` });
    }
    if (!runtimePath.endsWith(".webp")) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: `${path}.runtimePath`, message: "Expected optimized .webp runtime path" });
    }
    const key = `${String(sourceCategory)}:${slug}`;
    if (seen.has(key)) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: `${path}.slug`, message: "Duplicate runtime asset source" });
    }
    seen.add(key);
    if (sourceCategory === "pokemon" && slug) {
      seenPokemon.add(slug);
    }
    if (sourceCategory === "item" && slug) {
      seenItems.add(slug);
    }
  });

  expectedPokemonSlugs.forEach((slug) => {
    if (!seenPokemon.has(slug)) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: "$.assets", message: "Missing Pokemon runtime asset source" });
    }
  });
  expectedItemSlugs.forEach((slug) => {
    if (!seenItems.has(slug)) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: "$.assets", message: "Missing compact item runtime asset source" });
    }
  });
  recommendedItemSlugs.forEach((slug) => {
    if (!seenItems.has(slug)) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: "$.assets", message: "Missing recommended item runtime asset source" });
    }
  });

  validateNoPrivatePaths(runtimeAssetSourcesOutputPath, report, issues);
}

function validateRecommendationSourceCoverage(
  source: ReturnType<typeof parsePokemonPreferenceSource>,
  issues: GenerationIssue[],
): void {
  const missingPokemonTerms = source.pokemonEntries.filter(
    (entry) => entry.preferenceTerms.length === 0 && !pokemonAllowedWithoutPreferenceTerms.has(entry.slug),
  );
  missingPokemonTerms.slice(0, 10).forEach((entry) => {
    issues.push({
      file: pokemonPreferencePath,
      slug: entry.slug,
      field: "$.pokemon[].preferenceTerms",
      message: "Expected original Pokemon preference source to include preference terms",
    });
  });

  if (source.itemEntries.length === 0) {
    issues.push({
      file: pokemonPreferencePath,
      field: "$.itemPreferenceTerms",
      message: "Expected item preference source to include item keyword rows",
    });
  }
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
  itemPreferenceTerms: string[],
  itemTranslationSource: ItemTranslationSource,
  issues: GenerationIssue[],
): CompactItemBuildResult {
  const row = manifestRow.values;
  const placeable = placeableRow?.values;
  const slug = requireField(row, "slug", itemManifestPath, manifestRow.rowNumber, issues);
  const name = requireField(row, "name", itemManifestPath, manifestRow.rowNumber, issues, slug);
  const category = nullable(firstText(row.category, placeable?.category, asString(rawJson?.menu_category)));
  const tags = parseStringArrayField(row.tags, "tags", itemManifestPath, manifestRow.rowNumber, slug, issues);

  if (!placeableRow) {
    issues.push({ file: placeableCsvPath, slug, message: "No matching placeable source row found for compact item" });
  }
  if (!rawJson) {
    issues.push({ file: placeableJsonPath, slug, message: "No matching raw JSON source row found for compact item" });
  }

  const sourceIndex = parseNumberField(row.sequence, "sequence", itemManifestPath, manifestRow.rowNumber, slug, issues);
  const sourceImagePath = toRootAbsolutePath(requireField(row, "relative_path", itemManifestPath, manifestRow.rowNumber, issues, slug));
  const runtimeImagePath = runtimeAssetPath("item", slug, sourceImagePath);
  const runtimeItem: CompactItem = {
    slug,
    name,
    nameZh: resolveItemTranslation(itemTranslationSource, slug, name),
    category,
    tags,
    imagePath: runtimeImagePath,
    recommendation: {
      isDyeable: isDyeableItem(rawJson),
      dyeColorVariants: normalizeDyeColorVariants(rawJson),
      itemPrimaryColor: null,
    },
  };

  return {
    item: runtimeItem,
    recommendationItem: {
      ...runtimeItem,
      recommendation: {
        ...runtimeItem.recommendation,
        preferenceTerms: uniqueSorted(itemPreferenceTerms.map(toPreferenceTerm).filter(Boolean)),
        roleTags: buildRoleTags(category, tags),
      },
    },
    assetSource: runtimeAssetSource("item", slug, sourceImagePath, runtimeImagePath),
    sortIndex: sourceIndex,
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
  return normalizeDyeColorVariants(rawJson).length > 0 || hasNonEmptyArray(rawJson.variantSrcs);
}

function normalizeDyeColorVariants(rawJson: RawJsonItem | undefined): string[] {
  if (!rawJson) {
    return [];
  }
  if (Array.isArray(rawJson.color_variants)) {
    return uniqueSorted(rawJson.color_variants.map((value) => String(value).trim().toLowerCase()).filter(Boolean));
  }
  if (Array.isArray(rawJson.variantSrcs)) {
    return uniqueSorted(
      rawJson.variantSrcs
        .map((entry) => (isRecord(entry) ? asString(entry.variant) : undefined))
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toLowerCase()),
    );
  }
  return [];
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

function parsePokemonPreferenceSource(
  text: string,
  issues: GenerationIssue[],
): {
  pokemonTermsBySlug: Map<string, string[]>;
  itemTermsBySlug: Map<string, string[]>;
  pokemonEntries: PokemonPreferenceSourceEntry[];
  itemEntries: ItemPreferenceSourceEntry[];
} {
  const parsed = parseJsonValue(text, pokemonPreferencePath, issues) as PokemonPreferenceSourceData;
  const pokemonTermsBySlug = new Map<string, string[]>();
  const itemTermsBySlug = new Map<string, string[]>();
  const pokemonEntries: PokemonPreferenceSourceEntry[] = [];
  const itemEntries: ItemPreferenceSourceEntry[] = [];

  if (!isRecord(parsed)) {
    issues.push({ file: pokemonPreferencePath, field: "$", message: "Expected Pokemon preference source object" });
    return { pokemonTermsBySlug, itemTermsBySlug, pokemonEntries, itemEntries };
  }
  if (parsed.schemaVersion !== "pokopiadex-pokemon-preferences.v1") {
    issues.push({ file: pokemonPreferencePath, field: "$.schemaVersion", message: "Expected pokopiadex-pokemon-preferences.v1" });
  }
  if (!Array.isArray(parsed.pokemon)) {
    issues.push({ file: pokemonPreferencePath, field: "$.pokemon", message: "Expected Pokemon preference array" });
  } else {
    parsed.pokemon.forEach((entry, index) => {
      const path = `$.pokemon[${index}]`;
      if (!isRecord(entry) || typeof entry.slug !== "string" || !Array.isArray(entry.preferenceTerms)) {
        issues.push({ file: pokemonPreferencePath, field: path, message: "Expected Pokemon preference entry with slug and preferenceTerms" });
        return;
      }
      const terms = uniqueSorted(entry.preferenceTerms.map((term) => String(term)).map(toPreferenceTerm).filter(Boolean));
      pokemonTermsBySlug.set(entry.slug, terms);
      pokemonEntries.push({ slug: entry.slug, preferenceTerms: terms });
    });
  }
  if (!Array.isArray(parsed.itemPreferenceTerms)) {
    issues.push({ file: pokemonPreferencePath, field: "$.itemPreferenceTerms", message: "Expected item keyword array" });
  } else {
    parsed.itemPreferenceTerms.forEach((entry, index) => {
      const path = `$.itemPreferenceTerms[${index}]`;
      if (!isRecord(entry) || typeof entry.slug !== "string" || !Array.isArray(entry.terms)) {
        issues.push({ file: pokemonPreferencePath, field: path, message: "Expected item keyword entry with slug and terms" });
        return;
      }
      const terms = uniqueSorted(entry.terms.map((term) => String(term)).map(toPreferenceTerm).filter(Boolean));
      itemTermsBySlug.set(entry.slug, terms);
      itemEntries.push({ slug: entry.slug, terms });
    });
  }

  return { pokemonTermsBySlug, itemTermsBySlug, pokemonEntries, itemEntries };
}

function validateCompactDataShape(data: CompactItemsData, issues: GenerationIssue[]): void {
  const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
  if ("generatedFrom" in data) {
    issues.push({ file: compactItemsOutputPath, field: "$.generatedFrom", message: "Build-only traceability must not enter runtime compact item data" });
  }
  if (gzipBytes >= maxCompactItemsGzipBytes) {
    issues.push({
      file: compactItemsOutputPath,
      field: "$",
      message: `Expected gzip size below ${maxCompactItemsGzipBytes} bytes, got ${gzipBytes}`,
    });
  }

  data.items.forEach((item) => {
    ["id", "event", "sources", "habitatItemCategoryIds", "favoriteCategoryIds", "sourceDataset", "sourceIndex", "sourceRow"].forEach((field) => {
      if (field in item) {
        issues.push({ file: compactItemsOutputPath, slug: item.slug, field: `$.${field}`, message: "Build-only compact item field must not enter runtime JSON" });
      }
    });
    ["colorSource", "fallbackReason", "preferenceTerms", "roleTags"].forEach((field) => {
      if (field in item.recommendation) {
        issues.push({ file: compactItemsOutputPath, slug: item.slug, field: `$.recommendation.${field}`, message: "Build-only recommendation field must not enter runtime JSON" });
      }
    });
    if (item.recommendation.isDyeable === null) {
      issues.push({ file: compactItemsOutputPath, slug: item.slug, field: "$.recommendation.isDyeable", message: "Expected derived dyeable status" });
    }
    if (item.recommendation.isDyeable === true && item.recommendation.dyeColorVariants.length === 0) {
      issues.push({
        file: compactItemsOutputPath,
        slug: item.slug,
        field: "$.recommendation.dyeColorVariants",
        message: "Expected dyeable item to include dye color variants",
      });
    }
    validateRootAbsoluteImagePath(
      item.imagePath,
      "/assets/runtime/items/",
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
      "/assets/runtime/pokemon/",
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
      ["itemName", "itemZhName", "itemImagePath", "category", "isDyeable", "pokemonPrimaryColor", "itemPrimaryColor"].forEach((field) => {
        if (field in entry) {
          issues.push({
            file,
            slug: entry.itemSlug,
            field: `$.recommendations[].${field}`,
            message: "Recommendation entry must resolve this field from runtime lookup instead of duplicating it",
          });
        }
      });
      const item = compactBySlug.get(entry.itemSlug);
      if (!item) {
        issues.push({ file, slug: entry.itemSlug, field: "$.recommendations[].itemSlug", message: "Recommendation item missing from compact data" });
        return;
      }
      validateRootAbsoluteImagePath(
        item.imagePath,
        "/assets/runtime/items/",
        file,
        entry.itemSlug,
        issues,
      );

      const expectedItemPrimaryColor = itemColorsBySlug.get(entry.itemSlug);
      if (itemColorsBySlug.has(entry.itemSlug) && item.recommendation.itemPrimaryColor !== expectedItemPrimaryColor) {
        issues.push({
          file: compactItemsOutputPath,
          slug: entry.itemSlug,
          field: "$.items[].recommendation.itemPrimaryColor",
          message: "Runtime item primary color differs from item color data",
        });
      }
      const dyeColorVariants = new Set(item.recommendation.dyeColorVariants);
      entry.recommendedDyeColors.forEach((color) => {
        if (!dyeColorVariants.has(color)) {
          issues.push({
            file,
            slug: entry.itemSlug,
            field: "$.recommendations[].recommendedDyeColors",
            message: `Recommended dye color ${color} is not available on compact item`,
          });
        }
      });
      if (item.recommendation.isDyeable === false && entry.recommendedDyeColors.length > 0) {
        issues.push({
          file,
          slug: entry.itemSlug,
          field: "$.recommendations[].recommendedDyeColors",
          message: "Expected no recommended dye colors for non-dyeable item",
        });
      }
      if (item.recommendation.isDyeable === true && entry.harmonyStatus === "passed" && entry.recommendedDyeColors.length === 0) {
        issues.push({
          file,
          slug: entry.itemSlug,
          field: "$.recommendations[].recommendedDyeColors",
          message: "Expected dye color recommendations when a dyeable item passes harmony",
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

function buildRuntimeAssetSources(
  pokemonSources: RuntimeAssetSourceEntry[],
  itemSources: RuntimeAssetSourceEntry[],
  compactItems: CompactItemsData,
  recommendations: RecommendationsData[],
  issues: GenerationIssue[],
): RuntimeAssetSourcesData {
  const itemSourceBySlug = new Map(itemSources.map((asset) => [asset.slug, asset]));
  const recommendedItemSlugs = new Set<string>();
  recommendations.forEach((recommendation) => {
    recommendation.recommendations.forEach((entry) => recommendedItemSlugs.add(entry.itemSlug));
  });

  recommendedItemSlugs.forEach((slug) => {
    if (!itemSourceBySlug.has(slug)) {
      issues.push({ file: runtimeAssetSourcesOutputPath, slug, field: "$.assets", message: "Recommended item has no runtime asset source" });
    }
  });

  const compactItemSlugs = new Set(compactItems.items.map((item) => item.slug));
  const assets = uniqueRuntimeAssetSources([...pokemonSources, ...itemSources.filter((asset) => compactItemSlugs.has(asset.slug))]);
  const pokemonCount = assets.filter((asset) => asset.sourceCategory === "pokemon").length;
  const itemCount = assets.filter((asset) => asset.sourceCategory === "item").length;

  return {
    schemaVersion: "runtime-asset-sources.v1",
    generatedFrom: {
      compactItemsPath: compactItemsOutputPath,
      pokemonIndexPath: pokemonIndexOutputPath,
      recommendationDataDir: recommendationsOutputDir,
      rawBoundary: "docs/pokopia_image_sources/**",
    },
    summary: {
      assetCount: assets.length,
      pokemonCount,
      itemCount,
    },
    assets,
  };
}

function uniqueRuntimeAssetSources(assets: RuntimeAssetSourceEntry[]): RuntimeAssetSourceEntry[] {
  const byKey = new Map<string, RuntimeAssetSourceEntry>();
  assets.forEach((asset) => {
    byKey.set(`${asset.sourceCategory}:${asset.slug}`, asset);
  });
  return Array.from(byKey.values()).sort(compareRuntimeAssetSource);
}

function compareRuntimeAssetSource(left: RuntimeAssetSourceEntry, right: RuntimeAssetSourceEntry): number {
  return (
    left.sourceCategory.localeCompare(right.sourceCategory, "en") ||
    left.slug.localeCompare(right.slug, "en") ||
    left.runtimePath.localeCompare(right.runtimePath, "en")
  );
}

function runtimeAssetSource(
  sourceCategory: RuntimeAssetSourceCategory,
  slug: string,
  sourceImagePath: string,
  runtimePath: string,
): RuntimeAssetSourceEntry {
  return {
    slug,
    sourceCategory,
    sourcePath: sourceImagePath.replace(/^\//, ""),
    runtimePath,
  };
}

function runtimeAssetPath(sourceCategory: RuntimeAssetSourceCategory, slug: string, sourceImagePath: string): string {
  const directory = sourceCategory === "pokemon" ? "pokemon" : "items";
  return `/assets/runtime/${directory}/${slug}.webp`;
}

function validateRootAbsoluteImagePath(
  imagePath: string,
  expectedPrefix: string,
  file: string,
  slug: string,
  issues: GenerationIssue[],
): void {
  if (!imagePath.startsWith(expectedPrefix)) {
    issues.push({ file, slug, field: "$.imagePath", message: `Expected root-absolute image path under ${expectedPrefix}` });
  }
  if (imagePath.includes("\\") || imagePath.includes("..")) {
    issues.push({ file, slug, field: "$.imagePath", message: "Expected normalized runtime image path" });
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

function toPreferenceTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, "en"));
}

function compareCompactBuildRows(left: CompactItemBuildResult, right: CompactItemBuildResult): number {
  return (
    (left.sortIndex ?? Number.MAX_SAFE_INTEGER) - (right.sortIndex ?? Number.MAX_SAFE_INTEGER) ||
    left.item.slug.localeCompare(right.item.slug, "en")
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
