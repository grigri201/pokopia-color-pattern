export const COMPACT_ITEMS_SCHEMA_VERSION = "compact-items.v1" as const;
export const POKEMON_INDEX_SCHEMA_VERSION = "pokemon-index.v1" as const;
export const ITEM_COLORS_SCHEMA_VERSION = "item-colors.v1" as const;
export const POKEMON_METADATA_OVERRIDES_SCHEMA_VERSION = "pokemon-metadata-overrides.v1" as const;

export type CompactItemColorSource = "extracted" | "override" | "fallback";
export type PokemonColorSource = "extracted" | "override" | "fallback";

export type CompactItemRecommendationFields = {
  isDyeable: boolean | null;
  itemPrimaryColor: string | null;
  colorSource: CompactItemColorSource | null;
  fallbackReason: string | null;
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

export type PokemonColorSwatch = {
  hex: string;
  percent: number;
};

export type PokemonIndexEntry = {
  slug: string;
  sequence: string;
  name: string;
  zhName: string | null;
  imagePath: string;
  primaryColor: string;
  palette: PokemonColorSwatch[];
  colorSource: PokemonColorSource;
  fallbackReason: string | null;
  overrideSource: string | null;
  pattern: string[];
};

export type PokemonIndexData = {
  schemaVersion: typeof POKEMON_INDEX_SCHEMA_VERSION;
  generatedFrom: {
    pokemonManifestPath: string;
    overridePath: string;
    rawBoundary: string;
  };
  summary: {
    pokemonCount: number;
    fallbackCount: number;
    overrideCount: number;
  };
  pokemon: PokemonIndexEntry[];
};

export type ItemColorEntry = {
  slug: string;
  itemPrimaryColor: string;
  colorSource: CompactItemColorSource;
  fallbackReason: string | null;
};

export type ItemColorsData = {
  schemaVersion: typeof ITEM_COLORS_SCHEMA_VERSION;
  generatedFrom: {
    compactItemsPath: string;
    rawBoundary: string;
  };
  summary: {
    itemCount: number;
    fallbackCount: number;
  };
  items: ItemColorEntry[];
};

export type PokemonMetadataOverrideEntry = {
  primaryColor?: string;
  palette?: string[];
  pattern?: string[];
};

export type PokemonMetadataOverridesData = {
  schemaVersion: typeof POKEMON_METADATA_OVERRIDES_SCHEMA_VERSION;
  pokemon: Record<string, PokemonMetadataOverrideEntry>;
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
  requireNullableHex(item.recommendation, "itemPrimaryColor", `${path}.recommendation`, issues, slug);
  requireNullableColorSource(item.recommendation, "colorSource", `${path}.recommendation`, issues, slug);
  requireNullableString(item.recommendation, "fallbackReason", `${path}.recommendation`, issues, slug);
  requireStringArray(item.recommendation, "preferenceTerms", `${path}.recommendation`, issues, slug);
  requireStringArray(item.recommendation, "roleTags", `${path}.recommendation`, issues, slug);
}

export function validatePokemonIndexData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected pokemon index data object" }];
  }

  requireLiteral(value, "schemaVersion", POKEMON_INDEX_SCHEMA_VERSION, "$", issues);

  if (!isRecord(value.generatedFrom)) {
    issues.push({ path: "$.generatedFrom", message: "Expected source traceability object" });
  }

  const summary = value.summary;
  if (isRecord(summary)) {
    requireNumber(summary, "pokemonCount", "$.summary", issues);
    requireNumber(summary, "fallbackCount", "$.summary", issues);
    requireNumber(summary, "overrideCount", "$.summary", issues);
  } else {
    issues.push({ path: "$.summary", message: "Expected summary object" });
  }

  if (!Array.isArray(value.pokemon)) {
    issues.push({ path: "$.pokemon", message: "Expected pokemon array" });
    return issues;
  }

  const slugs = new Set<string>();
  value.pokemon.forEach((pokemon, index) => {
    const path = `$.pokemon[${index}]`;
    if (!isRecord(pokemon)) {
      issues.push({ path, message: "Expected pokemon object" });
      return;
    }

    const slug = typeof pokemon.slug === "string" ? pokemon.slug : undefined;
    requireSlug(pokemon, "slug", path, issues);
    requireString(pokemon, "sequence", path, issues, slug);
    requireString(pokemon, "name", path, issues, slug);
    requireNullableString(pokemon, "zhName", path, issues, slug);
    requireString(pokemon, "imagePath", path, issues, slug);
    requireHex(pokemon, "primaryColor", path, issues, slug);
    requirePalette(pokemon, "palette", path, issues, slug);
    requireColorSource(pokemon, "colorSource", path, issues, slug);
    requireNullableString(pokemon, "fallbackReason", path, issues, slug);
    requireNullableString(pokemon, "overrideSource", path, issues, slug);
    requireStringArray(pokemon, "pattern", path, issues, slug);

    if (slug) {
      if (slugs.has(slug)) {
        issues.push({ path: `${path}.slug`, message: "Duplicate pokemon slug", slug });
      }
      slugs.add(slug);
    }
  });

  if (isRecord(summary) && typeof summary.pokemonCount === "number" && summary.pokemonCount !== value.pokemon.length) {
    issues.push({
      path: "$.summary.pokemonCount",
      message: `Expected pokemonCount ${summary.pokemonCount} to match pokemon length ${value.pokemon.length}`,
    });
  }
  if (isRecord(summary)) {
    const fallbackCount = value.pokemon.filter(
      (pokemon) => isRecord(pokemon) && pokemon.colorSource === "fallback",
    ).length;
    const overrideCount = value.pokemon.filter(
      (pokemon) => isRecord(pokemon) && (pokemon.colorSource === "override" || typeof pokemon.overrideSource === "string"),
    ).length;
    if (typeof summary.fallbackCount === "number" && summary.fallbackCount !== fallbackCount) {
      issues.push({
        path: "$.summary.fallbackCount",
        message: `Expected fallbackCount ${summary.fallbackCount} to match actual fallback count ${fallbackCount}`,
      });
    }
    if (typeof summary.overrideCount === "number" && summary.overrideCount !== overrideCount) {
      issues.push({
        path: "$.summary.overrideCount",
        message: `Expected overrideCount ${summary.overrideCount} to match actual override count ${overrideCount}`,
      });
    }
  }

  return issues;
}

export function validatePokemonMetadataOverridesData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected pokemon metadata overrides object" }];
  }

  requireLiteral(value, "schemaVersion", POKEMON_METADATA_OVERRIDES_SCHEMA_VERSION, "$", issues);
  if (!isRecord(value.pokemon)) {
    issues.push({ path: "$.pokemon", message: "Expected pokemon override map" });
    return issues;
  }

  Object.entries(value.pokemon).forEach(([slug, override]) => {
    const path = `$.pokemon.${slug}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      issues.push({ path, message: "Expected canonical kebab-case override slug", slug });
    }
    if (!isRecord(override)) {
      issues.push({ path, message: "Expected override object", slug });
      return;
    }

    if ("primaryColor" in override) {
      requireOptionalHex(override, "primaryColor", path, issues, slug);
    }
    if ("palette" in override) {
      requireOptionalHexArray(override, "palette", path, issues, slug);
    }
    if ("pattern" in override) {
      requireStringArray(override, "pattern", path, issues, slug);
    }
  });

  return issues;
}

export function validateItemColorsData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected item colors data object" }];
  }

  requireLiteral(value, "schemaVersion", ITEM_COLORS_SCHEMA_VERSION, "$", issues);
  if (!isRecord(value.generatedFrom)) {
    issues.push({ path: "$.generatedFrom", message: "Expected source traceability object" });
  }

  const summary = value.summary;
  if (isRecord(summary)) {
    requireNumber(summary, "itemCount", "$.summary", issues);
    requireNumber(summary, "fallbackCount", "$.summary", issues);
  } else {
    issues.push({ path: "$.summary", message: "Expected summary object" });
  }

  if (!Array.isArray(value.items)) {
    issues.push({ path: "$.items", message: "Expected item color array" });
    return issues;
  }

  const slugs = new Set<string>();
  value.items.forEach((item, index) => {
    const path = `$.items[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path, message: "Expected item color object" });
      return;
    }
    const slug = typeof item.slug === "string" ? item.slug : undefined;
    requireSlug(item, "slug", path, issues);
    requireHex(item, "itemPrimaryColor", path, issues, slug);
    requireColorSource(item, "colorSource", path, issues, slug);
    requireNullableString(item, "fallbackReason", path, issues, slug);
    if (slug) {
      if (slugs.has(slug)) {
        issues.push({ path: `${path}.slug`, message: "Duplicate item color slug", slug });
      }
      slugs.add(slug);
    }
  });

  if (isRecord(summary) && typeof summary.itemCount === "number" && summary.itemCount !== value.items.length) {
    issues.push({
      path: "$.summary.itemCount",
      message: `Expected itemCount ${summary.itemCount} to match item color length ${value.items.length}`,
    });
  }
  if (isRecord(summary)) {
    const fallbackCount = value.items.filter((item) => isRecord(item) && item.colorSource === "fallback").length;
    if (typeof summary.fallbackCount === "number" && summary.fallbackCount !== fallbackCount) {
      issues.push({
        path: "$.summary.fallbackCount",
        message: `Expected fallbackCount ${summary.fallbackCount} to match actual fallback count ${fallbackCount}`,
      });
    }
  }

  return issues;
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

function requireColorSource(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (typeof value !== "string" || !colorSources.has(value)) {
    issue(path, key, "Expected known color source", issues, slug);
  }
}

function requireHex(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (typeof record[key] !== "string" || !isHexColor(record[key])) {
    issue(path, key, "Expected #RRGGBB hex color", issues, slug);
  }
}

function requireNullableHex(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (record[key] !== null && (typeof record[key] !== "string" || !isHexColor(record[key]))) {
    issue(path, key, "Expected #RRGGBB hex color or null", issues, slug);
  }
}

function requireOptionalHex(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (record[key] !== undefined && (typeof record[key] !== "string" || !isHexColor(record[key]))) {
    issue(path, key, "Expected #RRGGBB hex color", issues, slug);
  }
}

function requireOptionalHexArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !isHexColor(item))) {
    issue(path, key, "Expected #RRGGBB hex color array", issues, slug);
  }
}

function requirePalette(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (!Array.isArray(value)) {
    issue(path, key, "Expected palette array", issues, slug);
    return;
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ path: `${path}.${key}[${index}]`, message: "Expected palette swatch object", slug });
      return;
    }
    requireHex(entry, "hex", `${path}.${key}[${index}]`, issues, slug);
    requireNumber(entry, "percent", `${path}.${key}[${index}]`, issues, slug);
  });
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

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-F]{6}$/.test(value);
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
