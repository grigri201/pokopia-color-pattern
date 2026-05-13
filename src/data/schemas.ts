export const COMPACT_ITEMS_SCHEMA_VERSION = "compact-items.v1" as const;

export type CompactItemColorSource = "extracted" | "override" | "fallback";

export type CompactItemRecommendationFields = {
  isDyeable: boolean | null;
  primaryColor: string | null;
  colorSource: CompactItemColorSource | null;
  preferenceTerms: string[];
  roleTags: string[];
};

export type CompactItem = {
  slug: string;
  id: string | null;
  name: string;
  nameZh: string | null;
  category: string | null;
  tags: string[];
  sources: string[];
  habitatItemCategoryIds: number[];
  favoriteCategoryIds: number[];
  imagePath: string;
  sourceDataset: string | null;
  sourceIndex: number | null;
  sourceRow: number;
  recommendation: CompactItemRecommendationFields;
};

export type CompactItemsData = {
  schemaVersion: typeof COMPACT_ITEMS_SCHEMA_VERSION;
  generatedFrom: {
    itemManifestPath: string;
    placeableCsvPath: string;
    placeableJsonPath: string;
    rawBoundary: string;
  };
  summary: {
    itemCount: number;
    categoryCounts: Record<string, number>;
    tagCounts: Record<string, number>;
  };
  items: CompactItem[];
};

export type SchemaIssue = {
  path: string;
  message: string;
  slug?: string;
};

type UnknownRecord = Record<string, unknown>;

const colorSources: ReadonlySet<string> = new Set(["extracted", "override", "fallback"]);

export function validateCompactItemsData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected compact items data object" }];
  }

  requireLiteral(value, "schemaVersion", COMPACT_ITEMS_SCHEMA_VERSION, "$", issues);

  const generatedFrom = value.generatedFrom;
  if (isRecord(generatedFrom)) {
    requireString(generatedFrom, "itemManifestPath", "$.generatedFrom", issues);
    requireString(generatedFrom, "placeableCsvPath", "$.generatedFrom", issues);
    requireString(generatedFrom, "placeableJsonPath", "$.generatedFrom", issues);
    requireString(generatedFrom, "rawBoundary", "$.generatedFrom", issues);
  } else {
    issues.push({ path: "$.generatedFrom", message: "Expected source traceability object" });
  }

  const summary = value.summary;
  if (isRecord(summary)) {
    requireNumber(summary, "itemCount", "$.summary", issues);
    requireNumberRecord(summary, "categoryCounts", "$.summary", issues);
    requireNumberRecord(summary, "tagCounts", "$.summary", issues);
  } else {
    issues.push({ path: "$.summary", message: "Expected summary object" });
  }

  if (!Array.isArray(value.items)) {
    issues.push({ path: "$.items", message: "Expected items array" });
    return issues;
  }

  if (value.items.length === 0) {
    issues.push({ path: "$.items", message: "Expected at least one compact item" });
  }

  const slugs = new Set<string>();
  value.items.forEach((item, index) => {
    const path = `$.items[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path, message: "Expected item object" });
      return;
    }

    const slug = typeof item.slug === "string" ? item.slug : undefined;
    validateCompactItem(item, path, issues, slug);

    if (slug) {
      if (slugs.has(slug)) {
        issues.push({ path: `${path}.slug`, message: "Duplicate item slug", slug });
      }
      slugs.add(slug);
    }
  });

  if (isRecord(summary) && typeof summary.itemCount === "number" && summary.itemCount !== value.items.length) {
    issues.push({
      path: "$.summary.itemCount",
      message: `Expected itemCount ${summary.itemCount} to match items length ${value.items.length}`,
    });
  }

  if (isRecord(summary) && areAllItemsRecords(value.items)) {
    compareNumberRecords(
      summary.categoryCounts,
      countBy(value.items, (item) => nullableCategoryName(item.category)),
      "$.summary.categoryCounts",
      issues,
    );
    compareNumberRecords(summary.tagCounts, countTags(value.items), "$.summary.tagCounts", issues);
  }

  return issues;
}

export function isCompactItemsData(value: unknown): value is CompactItemsData {
  return validateCompactItemsData(value).length === 0;
}

function validateCompactItem(
  item: UnknownRecord,
  path: string,
  issues: SchemaIssue[],
  slug: string | undefined,
): void {
  requireSlug(item, "slug", path, issues);
  requireNullableString(item, "id", path, issues, slug);
  requireString(item, "name", path, issues, slug);
  requireNullableString(item, "nameZh", path, issues, slug);
  requireNullableString(item, "category", path, issues, slug);
  requireStringArray(item, "tags", path, issues, slug);
  requireStringArray(item, "sources", path, issues, slug);
  requireNumberArray(item, "habitatItemCategoryIds", path, issues, slug);
  requireNumberArray(item, "favoriteCategoryIds", path, issues, slug);
  requireString(item, "imagePath", path, issues, slug);
  requireNullableString(item, "sourceDataset", path, issues, slug);
  requireNullableNumber(item, "sourceIndex", path, issues, slug);
  requireNumber(item, "sourceRow", path, issues, slug);

  if (!isRecord(item.recommendation)) {
    issues.push({ path: `${path}.recommendation`, message: "Expected recommendation fields object", slug });
    return;
  }

  requireNullableBoolean(item.recommendation, "isDyeable", `${path}.recommendation`, issues, slug);
  requireNullableString(item.recommendation, "primaryColor", `${path}.recommendation`, issues, slug);
  requireNullableColorSource(item.recommendation, "colorSource", `${path}.recommendation`, issues, slug);
  requireStringArray(item.recommendation, "preferenceTerms", `${path}.recommendation`, issues, slug);
  requireStringArray(item.recommendation, "roleTags", `${path}.recommendation`, issues, slug);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(path: string, key: string, message: string, issues: SchemaIssue[], slug?: string): void {
  issues.push({ path: `${path}.${key}`, message, slug });
}

function requireLiteral(
  record: UnknownRecord,
  key: string,
  expected: string,
  path: string,
  issues: SchemaIssue[],
): void {
  if (record[key] !== expected) {
    issue(path, key, `Expected ${expected}`, issues);
  }
}

function requireString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (typeof record[key] !== "string" || record[key] === "") {
    issue(path, key, "Expected non-empty string", issues, slug);
  }
}

function requireSlug(record: UnknownRecord, key: string, path: string, issues: SchemaIssue[]): void {
  const value = record[key];
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    issue(path, key, "Expected canonical kebab-case slug", issues);
  }
}

function requireNullableString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (record[key] !== null && typeof record[key] !== "string") {
    issue(path, key, "Expected string or null", issues, slug);
  }
}

function requireNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
    issue(path, key, "Expected finite number", issues, slug);
  }
}

function requireNullableNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (record[key] !== null && (typeof record[key] !== "number" || !Number.isFinite(record[key]))) {
    issue(path, key, "Expected finite number or null", issues, slug);
  }
}

function requireNullableBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (record[key] !== null && typeof record[key] !== "boolean") {
    issue(path, key, "Expected boolean or null", issues, slug);
  }
}

function requireNullableColorSource(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (value !== null && (typeof value !== "string" || !colorSources.has(value))) {
    issue(path, key, "Expected known color source or null", issues, slug);
  }
}

function requireStringArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    issue(path, key, "Expected string array", issues, slug);
  }
}

function requireNumberArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    issue(path, key, "Expected finite number array", issues, slug);
  }
}

function requireNumberRecord(record: UnknownRecord, key: string, path: string, issues: SchemaIssue[]): void {
  const value = record[key];
  if (!isRecord(value)) {
    issue(path, key, "Expected object with numeric values", issues);
    return;
  }

  Object.entries(value).forEach(([entryKey, entryValue]) => {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      issues.push({ path: `${path}.${key}.${entryKey}`, message: "Expected finite number" });
    }
  });
}

function areAllItemsRecords(items: unknown[]): items is Array<UnknownRecord & { tags: string[] }> {
  return items.every((item) => isRecord(item) && Array.isArray(item.tags));
}

function nullableCategoryName(value: unknown): string {
  return typeof value === "string" && value ? value : "Uncategorized";
}

function countBy(items: UnknownRecord[], select: (item: UnknownRecord) => string): Record<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return sortedRecord(counts);
}

function countTags(items: Array<UnknownRecord & { tags: string[] }>): Record<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    item.tags.forEach((tag) => {
      if (typeof tag === "string") {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    });
  });
  return sortedRecord(counts);
}

function sortedRecord(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function compareNumberRecords(
  actual: unknown,
  expected: Record<string, number>,
  path: string,
  issues: SchemaIssue[],
): void {
  if (!isRecord(actual)) {
    return;
  }

  const actualEntries = Object.entries(actual).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  const actualJson = JSON.stringify(sortedRecord(new Map(actualEntries)));
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    issues.push({ path, message: "Summary counts do not match items" });
  }
}
