import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  COMPACT_ITEMS_SCHEMA_VERSION,
  ITEM_COLORS_SCHEMA_VERSION,
  POKEMON_INDEX_SCHEMA_VERSION,
  type CompactItem,
  type CompactItemsData,
  type ItemColorEntry,
  type ItemColorsData,
  type PokemonColorSwatch,
  type PokemonIndexData,
  type PokemonIndexEntry,
  type PokemonMetadataOverrideEntry,
  type PokemonMetadataOverridesData,
  validateCompactItemsData,
  validateItemColorsData,
  validatePokemonIndexData,
  validatePokemonMetadataOverridesData,
} from "../src/data/schemas.js";
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

const maxCompactItemsGzipBytes = 50 * 1024;
const maxItemColorsGzipBytes = 25 * 1024;
const maxPokemonIndexGzipBytes = 40 * 1024;
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

  validateAllData(compactItems, itemColors, pokemonIndex, overrides, issues);

  if (issues.length > 0) {
    printIssues("Data generation failed", issues);
    process.exitCode = 1;
    return;
  }

  await Promise.all([
    writeJsonFile(absoluteCompactItemsOutputPath, compactItems),
    writeJsonFile(absoluteItemColorsOutputPath, itemColors),
    writeJsonFile(absolutePokemonIndexOutputPath, pokemonIndex),
  ]);

  const compactGzipBytes = gzipSync(serializeJsonForOutput(compactItems)).length;
  console.log(`Generated ${compactItemsOutputPath} with ${compactItems.items.length} compact items (${compactGzipBytes} gzip bytes).`);
  console.log(`Generated ${itemColorsOutputPath} with ${itemColors.items.length} item colors.`);
  console.log(`Generated ${pokemonIndexOutputPath} with ${pokemonIndex.pokemon.length} Pokemon.`);
}

async function validateExistingOutputs(): Promise<void> {
  const issues: GenerationIssue[] = [];
  const [compactText, itemColorsText, pokemonIndexText, overrideText] = await Promise.all([
    readFile(absoluteCompactItemsOutputPath, "utf8"),
    readFile(absoluteItemColorsOutputPath, "utf8"),
    readFile(absolutePokemonIndexOutputPath, "utf8"),
    readFile(absolutePokemonOverridePath, "utf8"),
  ]);

  const compactItems = parseJsonValue(compactText, compactItemsOutputPath, issues);
  const itemColors = parseJsonValue(itemColorsText, itemColorsOutputPath, issues);
  const pokemonIndex = parseJsonValue(pokemonIndexText, pokemonIndexOutputPath, issues);
  const overrides = parseJsonValue(overrideText, pokemonOverridePath, issues);

  validateAllData(compactItems, itemColors, pokemonIndex, overrides, issues);

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
    `Validated ${compactItemsOutputPath} (${compactCount}), ${itemColorsOutputPath} (${itemColorCount}), and ${pokemonIndexOutputPath} (${pokemonCount}).`,
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

    if (override?.primaryColor || override?.palette) {
      const overridePalette = buildOverridePalette(override);
      return {
        slug,
        sequence,
        name,
        zhName: nullable(row.values.name_zh_hans),
        imagePath,
        primaryColor: normalizeHex(override.primaryColor ?? overridePalette[0]?.hex ?? DEFAULT_FALLBACK_COLOR),
        palette: overridePalette,
        colorSource: "override",
        fallbackReason: null,
        overrideSource: `${pokemonOverridePath}#pokemon.${slug}`,
        pattern: override.pattern ?? overridePalette.map((color) => color.hex),
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
        overrideSource: override?.pattern ? `${pokemonOverridePath}#pokemon.${slug}` : null,
        pattern: override?.pattern ?? palette.map((color) => color.hex),
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
      overrideSource: override?.pattern ? `${pokemonOverridePath}#pokemon.${slug}` : null,
      pattern: override?.pattern ?? [],
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

function validateAllData(
  compactItems: unknown,
  itemColors: unknown,
  pokemonIndex: unknown,
  overrides: unknown,
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

  if (issues.length === 0) {
    validateCompactDataShape(compactItems as CompactItemsData, issues);
    validateItemColorShape(itemColors as ItemColorsData, compactItems as CompactItemsData, issues);
    validatePokemonIndexShape(pokemonIndex as PokemonIndexData, issues);
    validateNoPrivatePaths(compactItemsOutputPath, compactItems, issues);
    validateNoPrivatePaths(itemColorsOutputPath, itemColors, issues);
    validateNoPrivatePaths(pokemonIndexOutputPath, pokemonIndex, issues);
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
    sources,
    habitatItemCategoryIds,
    favoriteCategoryIds,
    imagePath: toRootAbsolutePath(requireField(row, "relative_path", itemManifestPath, manifestRow.rowNumber, issues, slug)),
    sourceDataset: nullable(row.source),
    sourceIndex,
    sourceRow: manifestRow.rowNumber,
    recommendation: {
      isDyeable: null,
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

function buildOverridePalette(override: PokemonMetadataOverrideEntry): PokemonColorSwatch[] {
  const colors = (override.palette?.length ? override.palette : [override.primaryColor ?? DEFAULT_FALLBACK_COLOR]).map(normalizeHex);
  let assigned = 0;
  return colors.map((hex, index) => {
    const percent = index === colors.length - 1 ? Math.round((100 - assigned) * 10) / 10 : Math.round((100 / colors.length) * 10) / 10;
    assigned += percent;
    return { hex, percent };
  });
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

function normalizeHex(value: string): string {
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
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
