import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  COMPACT_ITEMS_SCHEMA_VERSION,
  type CompactItem,
  type CompactItemsData,
  validateCompactItemsData,
} from "../src/data/schemas.js";
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
const outputPath = "generated/data/compact-items.json";
const maxCompactItemsGzipBytes = 50 * 1024;

const absoluteItemManifestPath = resolve(projectRoot, itemManifestPath);
const absolutePlaceableCsvPath = resolve(projectRoot, placeableCsvPath);
const absolutePlaceableJsonPath = resolve(projectRoot, placeableJsonPath);
const absoluteOutputPath = resolve(projectRoot, outputPath);
const localImageRoot = resolve(projectRoot, "docs/pokopia_image_sources/item_portraits");

const validateOnly = process.argv.includes("--validate-only");

if (validateOnly) {
  await validateExistingOutput();
} else {
  await generateCompactItems();
}

async function generateCompactItems(): Promise<void> {
  const issues: GenerationIssue[] = [];
  const [manifestCsv, placeableCsv, placeableJsonText] = await Promise.all([
    readFile(absoluteItemManifestPath, "utf8"),
    readFile(absolutePlaceableCsvPath, "utf8"),
    readFile(absolutePlaceableJsonPath, "utf8"),
  ]);

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

  const data: CompactItemsData = {
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

  const schemaIssues = validateCompactItemsData(data);
  schemaIssues.forEach((issue) =>
    issues.push({
      file: outputPath,
      slug: issue.slug,
      field: issue.path,
      message: issue.message,
    }),
  );
  validateGeneratedDataShape(data, issues);

  if (issues.length > 0) {
    printIssues("Compact item generation failed", issues);
    process.exitCode = 1;
    return;
  }

  await writeJsonFile(absoluteOutputPath, data);
  const gzipBytes = gzipSync(serializeJsonForOutput(data)).length;
  console.log(`Generated ${outputPath} with ${data.items.length} compact items (${gzipBytes} gzip bytes).`);
}

async function validateExistingOutput(): Promise<void> {
  const text = await readFile(absoluteOutputPath, "utf8");
  const issues: GenerationIssue[] = [];
  const data = parseJsonValue(text, outputPath, issues);
  if (issues.length > 0) {
    printIssues("Compact item validation failed", issues);
    process.exitCode = 1;
    return;
  }

  validateCompactItemsData(data).forEach((issue) =>
    issues.push({
      file: outputPath,
      slug: issue.slug,
      field: issue.path,
      message: issue.message,
    }),
  );
  if (issues.length === 0) {
    validateGeneratedDataShape(data as CompactItemsData, issues);
  }

  if (issues.length > 0) {
    printIssues("Compact item validation failed", issues);
    process.exitCode = 1;
    return;
  }

  const count = Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items.length : 0;
  console.log(`Validated ${outputPath} with ${count} compact items.`);
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
    issues.push({
      file: placeableCsvPath,
      slug,
      message: "No matching placeable source row found for compact item",
    });
  }

  if (!rawJson) {
    issues.push({
      file: placeableJsonPath,
      slug,
      message: "No matching raw JSON source row found for compact item",
    });
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
    imagePath: toRootAbsolutePath(
      requireField(row, "relative_path", itemManifestPath, manifestRow.rowNumber, issues, slug),
    ),
    sourceDataset: nullable(row.source),
    sourceIndex,
    sourceRow: manifestRow.rowNumber,
    recommendation: {
      isDyeable: null,
      primaryColor: null,
      colorSource: null,
      preferenceTerms: [],
      roleTags: buildRoleTags(category, tags),
    },
  };
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

function validateGeneratedDataShape(data: CompactItemsData, issues: GenerationIssue[]): void {
  const serialized = serializeJsonForOutput(data);
  const gzipBytes = gzipSync(serialized).length;
  if (gzipBytes >= maxCompactItemsGzipBytes) {
    issues.push({
      file: outputPath,
      field: "$",
      message: `Expected gzip size below ${maxCompactItemsGzipBytes} bytes, got ${gzipBytes}`,
    });
  }

  data.items.forEach((item) => {
    if (!item.imagePath.startsWith("/docs/pokopia_image_sources/item_portraits/")) {
      issues.push({
        file: outputPath,
        slug: item.slug,
        field: "$.items[].imagePath",
        message: "Expected root-absolute item portrait path under /docs/pokopia_image_sources/item_portraits/",
      });
    }

    const localImagePath = resolve(projectRoot, item.imagePath.slice(1));
    const rootRelativeImagePath = relative(localImageRoot, localImagePath);
    if (rootRelativeImagePath.startsWith("..") || isAbsolute(rootRelativeImagePath)) {
      issues.push({
        file: outputPath,
        slug: item.slug,
        field: "$.items[].imagePath",
        message: "Referenced image path escapes item portrait root",
      });
    }

    if (!existsSync(localImagePath)) {
      issues.push({
        file: outputPath,
        slug: item.slug,
        field: "$.items[].imagePath",
        message: `Referenced image file does not exist: ${item.imagePath}`,
      });
    }
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

function parseNullableNumber(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

function serializeJsonForOutput(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
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
