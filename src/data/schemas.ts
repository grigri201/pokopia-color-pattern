export const COMPACT_ITEMS_SCHEMA_VERSION = "compact-items.v4" as const;
export const POKEMON_INDEX_SCHEMA_VERSION = "pokemon-index.v2" as const;
export const ITEM_COLORS_SCHEMA_VERSION = "item-colors.v1" as const;
export const RECOMMENDATIONS_SCHEMA_VERSION = "recommendations.v4" as const;
export const POKEMON_METADATA_OVERRIDES_SCHEMA_VERSION = "pokemon-metadata-overrides.v1" as const;
export const RUNTIME_ASSET_MANIFEST_SCHEMA_VERSION = "runtime-asset-manifest.v1" as const;

export type CompactItemColorSource = "extracted" | "override" | "fallback";
export type FurnitureSize = "large" | "other";
export type PokemonBodySize = "large" | "other";
export type PokemonColorSource = "extracted" | "override" | "fallback";
export type PokemonPreferenceSource = "metadata" | "override";
export type PokemonRecommendationOverrideMode = "append" | "replace";
export type RecommendationHarmonyStatus = "not_required" | "passed" | "override";
export type RecommendationHarmonyType = "analogous" | "complementary" | "splitComplementary" | "triadic" | "monochrome";
export type RuntimeAssetSourceCategory = "pokemon" | "item";

export type CompactItemRecommendationFields = {
  isDyeable: boolean | null;
  dyeColorVariants: string[];
  itemPrimaryColor: string | null;
  furnitureSize: FurnitureSize | null;
};

export type CompactItem = {
  slug: string;
  name: string;
  nameZh: string | null;
  category: string | null;
  tags: string[];
  imagePath: string;
  recommendation: CompactItemRecommendationFields;
};

export type CompactItemsData = {
  schemaVersion: typeof COMPACT_ITEMS_SCHEMA_VERSION;
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
  bodySize: PokemonBodySize;
  imagePath: string;
  primaryColor: string;
  palette: PokemonColorSwatch[];
  colorSource: PokemonColorSource;
  fallbackReason: string | null;
  overrideSource: string | null;
  pattern: string[];
  preferenceTerms: string[];
  preferenceSource: PokemonPreferenceSource | null;
};

export type PokemonIndexData = {
  schemaVersion: typeof POKEMON_INDEX_SCHEMA_VERSION;
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

export type RecommendationEntry = {
  itemSlug: string;
  matchedPreferenceTerms: string[];
  harmonyStatus: RecommendationHarmonyStatus;
  harmonyType: RecommendationHarmonyType | null;
  recommendedDyeColors: string[];
  overrideSource: string | null;
  rank: number;
  pageIndex: number;
};

export type RecommendationsData = {
  schemaVersion: typeof RECOMMENDATIONS_SCHEMA_VERSION;
  pokemonSlug: string;
  pageSize: 10;
  totalPages: number;
  recommendations: RecommendationEntry[];
};

export type PokemonRecommendedItemOverrideEntry = {
  itemSlug: string;
  matchedPreferenceTerms: string[];
};

export type PokemonRecommendedItemsOverride = {
  mode: PokemonRecommendationOverrideMode;
  items: PokemonRecommendedItemOverrideEntry[];
};

export type PokemonMetadataOverrideEntry = {
  primaryColor?: string;
  palette?: string[];
  pattern?: string[];
  preferenceTerms?: string[];
  recommendedItems?: PokemonRecommendedItemsOverride;
};

export type PokemonMetadataOverridesData = {
  schemaVersion: typeof POKEMON_METADATA_OVERRIDES_SCHEMA_VERSION;
  pokemon: Record<string, PokemonMetadataOverrideEntry>;
};

export type RuntimeAssetManifestEntry = {
  slug: string;
  sourceCategory: RuntimeAssetSourceCategory;
  runtimePath: string;
  byteSize: number;
  contentType: string;
  width: number;
  height: number;
};

export type RuntimeAssetManifestData = {
  schemaVersion: typeof RUNTIME_ASSET_MANIFEST_SCHEMA_VERSION;
  summary: {
    assetCount: number;
    pokemonCount: number;
    itemCount: number;
    totalBytes: number;
  };
  assets: RuntimeAssetManifestEntry[];
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
  requireAllowedKeys(value, ["schemaVersion", "summary", "items"], "$", issues);

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
  requireAllowedKeys(item, ["slug", "name", "nameZh", "category", "tags", "imagePath", "recommendation"], path, issues, slug);
  requireSlug(item, "slug", path, issues);
  requireString(item, "name", path, issues, slug);
  requireNullableString(item, "nameZh", path, issues, slug);
  requireNullableString(item, "category", path, issues, slug);
  requireStringArray(item, "tags", path, issues, slug);
  requireRuntimeDataImagePath(item, "imagePath", path, issues, "item", slug);

  if (!isRecord(item.recommendation)) {
    issues.push({ path: `${path}.recommendation`, message: "Expected recommendation fields object", slug });
    return;
  }

  requireAllowedKeys(item.recommendation, ["isDyeable", "dyeColorVariants", "itemPrimaryColor", "furnitureSize"], `${path}.recommendation`, issues, slug);
  requireNullableBoolean(item.recommendation, "isDyeable", `${path}.recommendation`, issues, slug);
  requireStringArray(item.recommendation, "dyeColorVariants", `${path}.recommendation`, issues, slug);
  requireNullableHex(item.recommendation, "itemPrimaryColor", `${path}.recommendation`, issues, slug);
  requireNullableFurnitureSize(item.recommendation, "furnitureSize", `${path}.recommendation`, issues, slug);
}

export function validatePokemonIndexData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected pokemon index data object" }];
  }

  requireLiteral(value, "schemaVersion", POKEMON_INDEX_SCHEMA_VERSION, "$", issues);
  requireAllowedKeys(value, ["schemaVersion", "summary", "pokemon"], "$", issues);

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

  if (value.pokemon.length === 0) {
    issues.push({ path: "$.pokemon", message: "Expected at least one Pokemon" });
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
    requirePokemonBodySize(pokemon, "bodySize", path, issues, slug);
    requireRuntimeDataImagePath(pokemon, "imagePath", path, issues, "pokemon", slug);
    requireHex(pokemon, "primaryColor", path, issues, slug);
    requirePalette(pokemon, "palette", path, issues, slug);
    requireColorSource(pokemon, "colorSource", path, issues, slug);
    requireNullableString(pokemon, "fallbackReason", path, issues, slug);
    requireNullableString(pokemon, "overrideSource", path, issues, slug);
    requireStringArray(pokemon, "pattern", path, issues, slug);
    requireStringArray(pokemon, "preferenceTerms", path, issues, slug);
    requireNullablePreferenceSource(pokemon, "preferenceSource", path, issues, slug);

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
    if ("preferenceTerms" in override) {
      requireStringArray(override, "preferenceTerms", path, issues, slug);
    }
    if ("recommendedItems" in override) {
      requireRecommendedItemsOverride(override, "recommendedItems", path, issues, slug);
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

export function validateRecommendationsData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected recommendations data object" }];
  }

  requireLiteral(value, "schemaVersion", RECOMMENDATIONS_SCHEMA_VERSION, "$", issues);
  requireAllowedKeys(value, ["schemaVersion", "pokemonSlug", "pageSize", "totalPages", "recommendations"], "$", issues);
  requireSlug(value, "pokemonSlug", "$", issues);
  requireLiteralNumber(value, "pageSize", 10, "$", issues);
  requireNonNegativeInteger(value, "totalPages", "$", issues);

  if (!Array.isArray(value.recommendations)) {
    issues.push({ path: "$.recommendations", message: "Expected recommendations array" });
    return issues;
  }

  const seenRanks = new Set<number>();
  const seenItemSlugs = new Set<string>();
  value.recommendations.forEach((entry, index) => {
    const path = `$.recommendations[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, message: "Expected recommendation object" });
      return;
    }

    const slug = typeof entry.itemSlug === "string" ? entry.itemSlug : undefined;
    requireAllowedKeys(
      entry,
      ["itemSlug", "matchedPreferenceTerms", "harmonyStatus", "harmonyType", "recommendedDyeColors", "overrideSource", "rank", "pageIndex"],
      path,
      issues,
      slug,
    );
    requireSlug(entry, "itemSlug", path, issues);
    if (slug) {
      if (seenItemSlugs.has(slug)) {
        issues.push({ path: `${path}.itemSlug`, message: "Duplicate recommendation item slug", slug });
      }
      seenItemSlugs.add(slug);
    }
    requireStringArray(entry, "matchedPreferenceTerms", path, issues, slug);
    requireNonEmptyNormalizedStringArray(entry, "matchedPreferenceTerms", path, issues, slug);
    requireRecommendationHarmonyStatus(entry, "harmonyStatus", path, issues, slug);
    requireNullableRecommendationHarmonyType(entry, "harmonyType", path, issues, slug);
    requireStringArray(entry, "recommendedDyeColors", path, issues, slug);
    requireNullableString(entry, "overrideSource", path, issues, slug);
    requirePositiveInteger(entry, "rank", path, issues, slug);
    requireNonNegativeInteger(entry, "pageIndex", path, issues, slug);

    if (typeof entry.rank === "number" && Number.isInteger(entry.rank)) {
      const expectedRank = index + 1;
      if (entry.rank !== expectedRank) {
        issues.push({ path: `${path}.rank`, message: `Expected rank ${expectedRank} to match recommendation array order`, slug });
      }
      if (seenRanks.has(entry.rank)) {
        issues.push({ path: `${path}.rank`, message: "Duplicate recommendation rank", slug });
      }
      seenRanks.add(entry.rank);

      const expectedPageIndex = Math.floor(index / 10);
      if (typeof entry.pageIndex === "number" && entry.pageIndex !== expectedPageIndex) {
        issues.push({
          path: `${path}.pageIndex`,
          message: `Expected zero-based pageIndex ${expectedPageIndex} for recommendation array index ${index}`,
          slug,
        });
      }
    }

    if (entry.harmonyStatus === "not_required" && entry.harmonyType !== null) {
      issues.push({ path: `${path}.harmonyType`, message: "Expected null harmonyType when harmony is not required", slug });
    }
    if (entry.harmonyStatus === "passed" && entry.harmonyType === null) {
      issues.push({ path: `${path}.harmonyType`, message: "Expected harmonyType when harmony passed", slug });
    }
    if (entry.harmonyStatus === "override") {
      if (typeof entry.overrideSource !== "string" || entry.overrideSource.trim() === "") {
        issues.push({ path: `${path}.overrideSource`, message: "Expected overrideSource when harmony status is override", slug });
      }
      if (entry.harmonyType !== null) {
        issues.push({ path: `${path}.harmonyType`, message: "Expected null harmonyType when harmony status is override", slug });
      }
    }
  });

  const expectedTotalPages = Math.ceil(value.recommendations.length / 10);
  if (typeof value.totalPages === "number" && value.totalPages !== expectedTotalPages) {
    issues.push({
      path: "$.totalPages",
      message: `Expected totalPages ${value.totalPages} to match recommendation length ${value.recommendations.length}`,
    });
  }
  for (let rank = 1; rank <= value.recommendations.length; rank += 1) {
    if (!seenRanks.has(rank)) {
      issues.push({ path: "$.recommendations", message: `Missing sequential recommendation rank ${rank}` });
    }
  }

  return issues;
}

export function validateRuntimeAssetManifestData(value: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "Expected runtime asset manifest object" }];
  }

  requireLiteral(value, "schemaVersion", RUNTIME_ASSET_MANIFEST_SCHEMA_VERSION, "$", issues);
  requireAllowedKeys(value, ["schemaVersion", "summary", "assets"], "$", issues);

  const summary = value.summary;
  if (isRecord(summary)) {
    requireNumber(summary, "assetCount", "$.summary", issues);
    requireNumber(summary, "pokemonCount", "$.summary", issues);
    requireNumber(summary, "itemCount", "$.summary", issues);
    requireNumber(summary, "totalBytes", "$.summary", issues);
  } else {
    issues.push({ path: "$.summary", message: "Expected summary object" });
  }

  if (!Array.isArray(value.assets)) {
    issues.push({ path: "$.assets", message: "Expected assets array" });
    return issues;
  }

  const keys = new Set<string>();
  let totalBytes = 0;
  let pokemonCount = 0;
  let itemCount = 0;
  value.assets.forEach((asset, index) => {
    const path = `$.assets[${index}]`;
    if (!isRecord(asset)) {
      issues.push({ path, message: "Expected runtime asset object" });
      return;
    }

    const slug = typeof asset.slug === "string" ? asset.slug : undefined;
    requireAllowedKeys(asset, ["slug", "sourceCategory", "runtimePath", "byteSize", "contentType", "width", "height"], path, issues, slug);
    requireSlug(asset, "slug", path, issues);
    requireRuntimeAssetSourceCategory(asset, "sourceCategory", path, issues, slug);
    requireRuntimeAssetPath(asset, "runtimePath", path, issues, slug);
    requireNonNegativeInteger(asset, "byteSize", path, issues, slug);
    requireString(asset, "contentType", path, issues, slug);
    requireNonNegativeInteger(asset, "width", path, issues, slug);
    requireNonNegativeInteger(asset, "height", path, issues, slug);
    if (typeof asset.runtimePath === "string" && typeof asset.contentType === "string") {
      const expectedExtension = extensionForRuntimeContentType(asset.contentType);
      if (expectedExtension === null) {
        issues.push({ path: `${path}.contentType`, message: "Expected image content type", slug });
      } else if (!asset.runtimePath.endsWith(expectedExtension)) {
        issues.push({ path: `${path}.runtimePath`, message: `Expected path extension ${expectedExtension} for ${asset.contentType}`, slug });
      }
    }

    if (slug && typeof asset.sourceCategory === "string") {
      const key = `${asset.sourceCategory}:${slug}`;
      if (keys.has(key)) {
        issues.push({ path: `${path}.slug`, message: "Duplicate runtime asset slug for source category", slug });
      }
      keys.add(key);
    }

    if (asset.sourceCategory === "pokemon") {
      pokemonCount += 1;
    }
    if (asset.sourceCategory === "item") {
      itemCount += 1;
    }
    if (typeof asset.byteSize === "number" && Number.isFinite(asset.byteSize)) {
      totalBytes += asset.byteSize;
    }
  });

  if (isRecord(summary)) {
    if (typeof summary.assetCount === "number" && summary.assetCount !== value.assets.length) {
      issues.push({ path: "$.summary.assetCount", message: `Expected assetCount ${summary.assetCount} to match assets length ${value.assets.length}` });
    }
    if (typeof summary.pokemonCount === "number" && summary.pokemonCount !== pokemonCount) {
      issues.push({ path: "$.summary.pokemonCount", message: `Expected pokemonCount ${summary.pokemonCount} to match asset rows ${pokemonCount}` });
    }
    if (typeof summary.itemCount === "number" && summary.itemCount !== itemCount) {
      issues.push({ path: "$.summary.itemCount", message: `Expected itemCount ${summary.itemCount} to match asset rows ${itemCount}` });
    }
    if (typeof summary.totalBytes === "number" && summary.totalBytes !== totalBytes) {
      issues.push({ path: "$.summary.totalBytes", message: `Expected totalBytes ${summary.totalBytes} to match asset byte sum ${totalBytes}` });
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

function requireLiteralNumber(
  record: UnknownRecord,
  key: string,
  expected: number,
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

function requireAllowedKeys(
  record: UnknownRecord,
  allowedKeys: string[],
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const allowed = new Set(allowedKeys);
  Object.keys(record).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({ path: `${path}.${key}`, message: "Unexpected runtime field", slug });
    }
  });
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

function requirePositiveInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (typeof record[key] !== "number" || !Number.isInteger(record[key]) || record[key] < 1) {
    issue(path, key, "Expected positive integer", issues, slug);
  }
}

function requireNonNegativeInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (typeof record[key] !== "number" || !Number.isInteger(record[key]) || record[key] < 0) {
    issue(path, key, "Expected non-negative integer", issues, slug);
  }
}

function requireNullableNonNegativeInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (record[key] !== null && (typeof record[key] !== "number" || !Number.isInteger(record[key]) || record[key] < 0)) {
    issue(path, key, "Expected non-negative integer or null", issues, slug);
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

function requireBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  if (typeof record[key] !== "boolean") {
    issue(path, key, "Expected boolean", issues, slug);
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

function requirePokemonBodySize(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (value !== "large" && value !== "other") {
    issue(path, key, "Expected large or other body size", issues, slug);
  }
}

function requireNullableFurnitureSize(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (value !== null && value !== "large" && value !== "other") {
    issue(path, key, "Expected large, other, or null furniture size", issues, slug);
  }
}

function requireRuntimeAssetSourceCategory(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (value !== "pokemon" && value !== "item") {
    issue(path, key, "Expected pokemon or item", issues, slug);
  }
}

function requireRuntimeAssetPath(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (typeof value !== "string" || !/^\/assets\/runtime\/(?:pokemon|items)\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(value)) {
    issue(path, key, "Expected root-absolute runtime asset path", issues, slug);
  }
}

function requireRuntimeDataImagePath(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  sourceCategory: RuntimeAssetSourceCategory,
  slug?: string,
): void {
  const value = record[key];
  const directory = sourceCategory === "pokemon" ? "pokemon" : "items";
  const pattern = new RegExp(`^/assets/runtime/${directory}/[a-z0-9]+(?:-[a-z0-9]+)*\\.webp$`);
  if (typeof value !== "string" || !pattern.test(value)) {
    issue(path, key, `Expected root-absolute /assets/runtime/${directory}/ image path`, issues, slug);
  }
}

function extensionForRuntimeContentType(contentType: string): string | null {
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

function requireRecommendationHarmonyStatus(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (value !== "not_required" && value !== "passed" && value !== "override") {
    issue(path, key, "Expected known recommendation harmony status", issues, slug);
  }
}

function requireRecommendedItemsOverride(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  const overridePath = `${path}.${key}`;
  if (!isRecord(value)) {
    issue(path, key, "Expected recommended items override object", issues, slug);
    return;
  }

  if (value.mode !== "append" && value.mode !== "replace") {
    issue(overridePath, "mode", "Expected append or replace", issues, slug);
  }
  if (!Array.isArray(value.items)) {
    issue(overridePath, "items", "Expected recommended item override array", issues, slug);
    return;
  }
  if (value.items.length === 0) {
    issue(overridePath, "items", "Expected at least one recommended item override", issues, slug);
  }

  const seenItemSlugs = new Set<string>();
  value.items.forEach((item, index) => {
    const itemPath = `${overridePath}.items[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path: itemPath, message: "Expected recommended item override object", slug });
      return;
    }

    const itemSlug = typeof item.itemSlug === "string" ? item.itemSlug : undefined;
    requireSlug(item, "itemSlug", itemPath, issues);
    if (itemSlug) {
      if (seenItemSlugs.has(itemSlug)) {
        issues.push({ path: `${itemPath}.itemSlug`, message: "Duplicate recommended item override slug", slug: itemSlug });
      }
      seenItemSlugs.add(itemSlug);
    }
    requireStringArray(item, "matchedPreferenceTerms", itemPath, issues, itemSlug);
    requireNonEmptyNormalizedStringArray(item, "matchedPreferenceTerms", itemPath, issues, itemSlug);
  });
}

function requireNullableRecommendationHarmonyType(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (
    value !== null &&
    value !== "analogous" &&
    value !== "complementary" &&
    value !== "splitComplementary" &&
    value !== "triadic" &&
    value !== "monochrome"
  ) {
    issue(path, key, "Expected known recommendation harmony type or null", issues, slug);
  }
}

function requireNullablePreferenceSource(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (value !== null && value !== "metadata" && value !== "override") {
    issue(path, key, "Expected known preference source or null", issues, slug);
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

function requireNonEmptyNormalizedStringArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: SchemaIssue[],
  slug?: string,
): void {
  const value = record[key];
  if (!Array.isArray(value)) {
    return;
  }
  if (value.length === 0) {
    issue(path, key, "Expected at least one matched preference term", issues, slug);
    return;
  }

  const seenTerms = new Set<string>();
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      return;
    }
    if (item !== normalizePreferenceTerm(item)) {
      issues.push({ path: `${path}.${key}[${index}]`, message: "Expected normalized preference term", slug });
    }
    if (seenTerms.has(item)) {
      issues.push({ path: `${path}.${key}[${index}]`, message: "Duplicate preference term", slug });
    }
    seenTerms.add(item);
  });
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

function normalizePreferenceTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
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
