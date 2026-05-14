import {
  RECOMMENDATIONS_SCHEMA_VERSION,
  type CompactItem,
  type CompactItemRecommendationFields,
  type ItemColorEntry,
  type PokemonIndexEntry,
  type PokemonMetadataOverrideEntry,
  type PokemonRecommendedItemsOverride,
  type RecommendationEntry,
  type RecommendationsData,
} from "../data/schemas.js";
import { evaluateOklchHarmony } from "./color-harmony.js";
import {
  buildRecommendationResults,
  matchRecommendationPreferenceTerms,
  rankRecommendationEntries,
  toPokemonPreferenceProfile,
  type ItemColorLookup,
  type RecommendationItemInput,
  type RecommendationRankingInput,
} from "./recommendation.js";

export const RECOMMENDATION_PAGE_SIZE = 10 as const;
export const RECOMMENDATION_DIAGNOSTICS_SCHEMA_VERSION = "recommendation-diagnostics.v1" as const;

const DYE_COLOR_HEX: Record<string, string> = {
  aquamarine: "#5BC7B8",
  beige: "#CBB99B",
  black: "#2D2A2E",
  blue: "#3478D9",
  brown: "#8A5A3B",
  cyan: "#35BFD0",
  "dark blue": "#263E7A",
  "dark purple": "#5A337D",
  gray: "#8A8F98",
  green: "#46A85D",
  "light blue": "#82B7F0",
  lime: "#9ACD32",
  magenta: "#C83F92",
  navy: "#263E7A",
  orange: "#F2852E",
  pink: "#F06A9B",
  plum: "#6E3F8F",
  purple: "#8B56D9",
  red: "#D8323F",
  rose: "#C83F92",
  turquoise: "#2FB8A2",
  white: "#F5F0E6",
  yellow: "#F4D248",
  "yellow green": "#9ACD32",
  "yellow-green": "#9ACD32",
};

export type RecommendationDataBuildIssue = {
  file?: string;
  field?: string;
  pokemonSlug: string;
  itemSlug?: string;
  message: string;
};

export type RecommendationDataSetOptions = {
  overrides?: Record<string, PokemonMetadataOverrideEntry>;
  overridePath?: string;
};

export type RecommendationDiagnosticsStatus = "empty" | "sparse" | "ready";
export type RecommendationDiagnosticsStrategy = "preference_terms" | "dyeable_default" | "override" | "empty";

export type RecommendationDiagnosticsReport = {
  schemaVersion: typeof RECOMMENDATION_DIAGNOSTICS_SCHEMA_VERSION;
  summary: {
    pokemonCount: number;
    emptyCount: number;
    sparseCount: number;
    readyCount: number;
    totalRecommendations: number;
  };
  pokemon: RecommendationPokemonDiagnostics[];
};

export type RecommendationPokemonDiagnostics = {
  pokemonSlug: string;
  status: RecommendationDiagnosticsStatus;
  recommendationCount: number;
  automaticRecommendationCount: number;
  defaultDyeableRecommendationCount: number;
  overrideRecommendationCount: number;
  candidateCount: number;
  excludedCount: number;
  harmonyRejectedCount: number;
  pokemonPrimaryColor: string;
  preferenceTerms: string[];
  preferenceSource: PokemonIndexEntry["preferenceSource"];
  recommendationStrategy: RecommendationDiagnosticsStrategy;
  recommendedItemsOverrideMode: PokemonRecommendedItemsOverride["mode"] | null;
  exclusionReasonCounts: Record<string, number>;
  harmonyRejectionReasonCounts: Record<string, number>;
  sampleExcluded: Array<{
    itemSlug: string;
    reason: string;
    preferenceTerms: string[];
  }>;
  sampleRejected: Array<{
    itemSlug: string;
    reason: string;
    matchedPreferenceTerms: string[];
    isDyeable: boolean;
    pokemonPrimaryColor: string;
    itemPrimaryColor: string | null;
    harmonyStatus: "failed";
    harmonyType: null;
  }>;
};

type RecommendationEntryDraft = Omit<RecommendationEntry, "rank" | "pageIndex"> &
  RecommendationRankingInput & {
    roleFitScore: number;
    overrideField?: string;
  };

export type RecommendationBuildCompactItem = CompactItem & {
  recommendation: CompactItemRecommendationFields & {
    preferenceTerms: string[];
    roleTags: string[];
  };
};

export function buildRecommendationDataSet(
  pokemon: PokemonIndexEntry[],
  compactItems: RecommendationBuildCompactItem[],
  itemColors: ItemColorEntry[],
  options: RecommendationDataSetOptions = {},
): { recommendations: RecommendationsData[]; diagnostics: RecommendationDiagnosticsReport; issues: RecommendationDataBuildIssue[] } {
  const compactBySlug = new Map(compactItems.map((item) => [item.slug, item]));
  const itemColorBySlug = new Map(itemColors.map((item) => [item.slug, item.itemPrimaryColor]));
  const itemColorLookup: ItemColorLookup[] = itemColors.map((item) => ({
    itemSlug: item.slug,
    itemPrimaryColor: item.itemPrimaryColor,
  }));
  const recommendationInputs: RecommendationItemInput[] = compactItems.map((item) => ({
    slug: item.slug,
    name: item.name,
    category: item.category,
    tags: item.tags,
    preferenceTerms: item.recommendation.preferenceTerms,
    roleTags: item.recommendation.roleTags,
    isDyeable: item.recommendation.isDyeable,
    dyeColorVariants: item.recommendation.dyeColorVariants,
  }));
  const recommendationInputBySlug = new Map(recommendationInputs.map((item) => [item.slug, item]));
  const issues: RecommendationDataBuildIssue[] = [];
  const diagnostics: RecommendationPokemonDiagnostics[] = [];

  const recommendations = pokemon.map((pokemonEntry): RecommendationsData => {
    const result =
      pokemonEntry.preferenceTerms.length > 0
        ? buildRecommendationResults(
            toPokemonPreferenceProfile(pokemonEntry),
            pokemonEntry.primaryColor,
            recommendationInputs,
            itemColorLookup,
          )
        : emptyRecommendationResult(pokemonEntry.slug);
    const colorMatchedDrafts: RecommendationEntryDraft[] = [];
    const colorMatchedDyeableSlugs = new Set<string>();

    result.recommendations.forEach((recommendation) => {
      const item = compactBySlug.get(recommendation.itemSlug);
      if (!item) {
        issues.push({
          pokemonSlug: pokemonEntry.slug,
          itemSlug: recommendation.itemSlug,
          message: "Recommendation has no matching compact item",
        });
        return;
      }

      if (recommendation.isDyeable) {
        const dyeableDraft = buildDyeableRecommendationDraft(
          pokemonEntry,
          item,
          itemColorBySlug.get(item.slug) ?? null,
          recommendation.matchedPreferenceTerms,
        );
        if (dyeableDraft.harmonyStatus === "passed") {
          colorMatchedDyeableSlugs.add(item.slug);
          colorMatchedDrafts.push(dyeableDraft);
        }
        return;
      }

      colorMatchedDrafts.push({
        itemSlug: recommendation.itemSlug,
        matchedPreferenceTerms: recommendation.matchedPreferenceTerms,
        isDyeable: recommendation.isDyeable,
        harmonyStatus: recommendation.harmonyStatus,
        harmonyType: recommendation.harmonyType,
        recommendedDyeColors: [],
        overrideSource: null,
        roleFitScore: recommendationRoleFitScore(recommendation.matchedPreferenceTerms, item),
      });
    });

    const defaultDyeableDrafts = buildDefaultDyeableRecommendationDrafts(
      pokemonEntry,
      compactItems,
      itemColorBySlug,
      recommendationInputBySlug,
      colorMatchedDyeableSlugs,
    );
    const recommendationOverride = options.overrides?.[pokemonEntry.slug]?.recommendedItems;
    const overrideDrafts = recommendationOverride
      ? buildOverrideRecommendationDrafts(
          pokemonEntry,
          recommendationOverride,
          compactBySlug,
          itemColorBySlug,
          options.overridePath ?? "data/overrides/pokemon-metadata.json",
          issues,
        )
      : [];
    const automaticDrafts = [
      ...rankRecommendationEntries(colorMatchedDrafts),
      ...rankRecommendationEntries(defaultDyeableDrafts),
    ];
    const drafts = applyRecommendedItemsOverride(
      automaticDrafts,
      overrideDrafts,
      recommendationOverride?.mode,
      pokemonEntry.slug,
      options.overridePath ?? "data/overrides/pokemon-metadata.json",
      issues,
    );

    const recommendations = drafts.map(({ roleFitScore: _roleFitScore, overrideField: _overrideField, isDyeable: _isDyeable, ...entry }, index) => ({
      ...entry,
      rank: index + 1,
      pageIndex: Math.floor(index / RECOMMENDATION_PAGE_SIZE),
    }));
    const status = recommendationDiagnosticsStatus(recommendations.length);

    diagnostics.push({
      pokemonSlug: pokemonEntry.slug,
      status,
      recommendationCount: recommendations.length,
      automaticRecommendationCount: automaticDrafts.length,
      defaultDyeableRecommendationCount: defaultDyeableDrafts.length,
      overrideRecommendationCount: overrideDrafts.length,
      candidateCount: result.candidates.length,
      excludedCount: result.excluded.length,
      harmonyRejectedCount: result.rejected.length,
      pokemonPrimaryColor: pokemonEntry.primaryColor,
      preferenceTerms: pokemonEntry.preferenceTerms,
      preferenceSource: pokemonEntry.preferenceSource,
      recommendationStrategy: recommendationStrategy(
        colorMatchedDrafts.length,
        defaultDyeableDrafts.length,
        overrideDrafts.length,
        recommendations.length,
      ),
      recommendedItemsOverrideMode: recommendationOverride?.mode ?? null,
      exclusionReasonCounts: countReasons(result.excluded),
      harmonyRejectionReasonCounts: countReasons(result.rejected),
      sampleExcluded: result.excluded.slice(0, 5).map((entry) => ({
        itemSlug: entry.itemSlug,
        reason: entry.reason,
        preferenceTerms: entry.preferenceTerms,
      })),
      sampleRejected: result.rejected.slice(0, 5).map((entry) => ({
        itemSlug: entry.itemSlug,
        reason: entry.reason,
        matchedPreferenceTerms: entry.matchedPreferenceTerms,
        isDyeable: entry.isDyeable,
        pokemonPrimaryColor: pokemonEntry.primaryColor,
        itemPrimaryColor: entry.itemPrimaryColor,
        harmonyStatus: entry.harmonyStatus,
        harmonyType: entry.harmonyType,
      })),
    });

    return {
      schemaVersion: RECOMMENDATIONS_SCHEMA_VERSION,
      pokemonSlug: pokemonEntry.slug,
      pageSize: RECOMMENDATION_PAGE_SIZE,
      totalPages: Math.ceil(recommendations.length / RECOMMENDATION_PAGE_SIZE),
      recommendations,
    };
  });

  return {
    recommendations,
    diagnostics: {
      schemaVersion: RECOMMENDATION_DIAGNOSTICS_SCHEMA_VERSION,
      summary: {
        pokemonCount: diagnostics.length,
        emptyCount: diagnostics.filter((entry) => entry.status === "empty").length,
        sparseCount: diagnostics.filter((entry) => entry.status === "sparse").length,
        readyCount: diagnostics.filter((entry) => entry.status === "ready").length,
        totalRecommendations: diagnostics.reduce((sum, entry) => sum + entry.recommendationCount, 0),
      },
      pokemon: diagnostics,
    },
    issues,
  };
}

function emptyRecommendationResult(pokemonSlug: string): ReturnType<typeof buildRecommendationResults> {
  return {
    pokemonSlug,
    candidates: [],
    excluded: [],
    recommendations: [],
    rejected: [],
  };
}

function buildDefaultDyeableRecommendationDrafts(
  pokemon: PokemonIndexEntry,
  compactItems: RecommendationBuildCompactItem[],
  itemColorBySlug: Map<string, string>,
  recommendationInputBySlug: Map<string, RecommendationItemInput>,
  excludedSlugs: Set<string>,
): RecommendationEntryDraft[] {
  return compactItems.flatMap((item): RecommendationEntryDraft[] => {
    if (item.recommendation.isDyeable !== true) {
      return [];
    }
    if (excludedSlugs.has(item.slug)) {
      return [];
    }

    const input = recommendationInputBySlug.get(item.slug);
    const matchedPreferenceTerms = input
      ? matchRecommendationPreferenceTerms(pokemon.preferenceTerms, input)
      : [];
    return [buildDyeableRecommendationDraft(pokemon, item, itemColorBySlug.get(item.slug) ?? null, matchedPreferenceTerms)];
  });
}

function buildDyeableRecommendationDraft(
  pokemon: PokemonIndexEntry,
  item: RecommendationBuildCompactItem,
  itemPrimaryColor: string | null,
  matchedPreferenceTerms: string[],
): RecommendationEntryDraft {
  const dyeMatches = selectRecommendedDyeColors(pokemon.primaryColor, item.recommendation.dyeColorVariants);
  const recommendedDyeColors = dyeMatches.length > 0
    ? dyeMatches.map((match) => match.color)
    : item.recommendation.dyeColorVariants.slice(0, 3);
  const recommendationTerms = normalizePreferenceTerms(
    matchedPreferenceTerms.length > 0
      ? [...matchedPreferenceTerms, "dyeable"]
      : ["dyeable", ...item.recommendation.roleTags, item.category ?? ""],
  );
  const firstHarmonyMatch = dyeMatches[0];

  return {
    itemSlug: item.slug,
    matchedPreferenceTerms: recommendationTerms,
    isDyeable: true,
    harmonyStatus: firstHarmonyMatch ? "passed" : "not_required",
    harmonyType: firstHarmonyMatch?.harmonyType ?? null,
    recommendedDyeColors,
    overrideSource: null,
    roleFitScore: recommendationRoleFitScore(recommendationTerms, item),
  };
}

function selectRecommendedDyeColors(
  pokemonPrimaryColor: string,
  dyeColorVariants: string[],
): Array<{ color: string; harmonyType: NonNullable<RecommendationEntry["harmonyType"]> }> {
  if (!isHexColor(pokemonPrimaryColor)) {
    return [];
  }

  return dyeColorVariants
    .flatMap((color) => {
      const colorHex = DYE_COLOR_HEX[toPreferenceTerm(color)];
      if (!colorHex) {
        return [];
      }
      const harmony = evaluateOklchHarmony(pokemonPrimaryColor, colorHex);
      if (harmony.harmonyStatus !== "passed" || !harmony.harmonyType) {
        return [];
      }
      return [{ color, harmonyType: harmony.harmonyType }];
    })
    .sort((left, right) => harmonyPriority(left.harmonyType) - harmonyPriority(right.harmonyType) || left.color.localeCompare(right.color, "en"))
    .slice(0, 4);
}

function recommendationStrategy(
  colorMatchedRecommendationCount: number,
  defaultDyeableRecommendationCount: number,
  overrideRecommendationCount: number,
  recommendationCount: number,
): RecommendationDiagnosticsStrategy {
  if (colorMatchedRecommendationCount > 0) {
    return "preference_terms";
  }
  if (defaultDyeableRecommendationCount > 0) {
    return "dyeable_default";
  }
  if (overrideRecommendationCount > 0) {
    return "override";
  }
  return recommendationCount > 0 ? "override" : "empty";
}

function recommendationDiagnosticsStatus(recommendationCount: number): RecommendationDiagnosticsStatus {
  if (recommendationCount === 0) {
    return "empty";
  }
  return recommendationCount < 3 ? "sparse" : "ready";
}

function countReasons<T extends { reason: string }>(entries: T[]): Record<string, number> {
  const counts = new Map<string, number>();
  entries.forEach((entry) => counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1));
  return Object.fromEntries(Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function buildOverrideRecommendationDrafts(
  pokemon: PokemonIndexEntry,
  recommendationOverride: PokemonRecommendedItemsOverride,
  compactBySlug: Map<string, RecommendationBuildCompactItem>,
  itemColorBySlug: Map<string, string>,
  overridePath: string,
  issues: RecommendationDataBuildIssue[],
): RecommendationEntryDraft[] {
  return recommendationOverride.items.flatMap((overrideItem, index): RecommendationEntryDraft[] => {
    const field = `$.pokemon.${pokemon.slug}.recommendedItems.items[${index}].itemSlug`;
    const item = compactBySlug.get(overrideItem.itemSlug);
    if (!item) {
      issues.push({
        file: overridePath,
        field,
        pokemonSlug: pokemon.slug,
        itemSlug: overrideItem.itemSlug,
        message: "Recommended item override has no matching compact item",
      });
      return [];
    }
    if (item.recommendation.isDyeable === null) {
      issues.push({
        file: overridePath,
        field,
        pokemonSlug: pokemon.slug,
        itemSlug: overrideItem.itemSlug,
        message: "Recommended item override has unknown dyeable status",
      });
      return [];
    }

    const itemPrimaryColor = itemColorBySlug.get(overrideItem.itemSlug) ?? null;
    const harmony = evaluateOverrideHarmony(pokemon.primaryColor, itemPrimaryColor, item.recommendation.isDyeable);
    const matchedPreferenceTerms = normalizePreferenceTerms(overrideItem.matchedPreferenceTerms);

    return [
      {
        itemSlug: item.slug,
        matchedPreferenceTerms,
        isDyeable: item.recommendation.isDyeable,
        harmonyStatus: harmony.harmonyStatus,
        harmonyType: harmony.harmonyType,
        recommendedDyeColors: item.recommendation.isDyeable
          ? buildDyeableRecommendationDraft(pokemon, item, itemPrimaryColor, matchedPreferenceTerms).recommendedDyeColors
          : [],
        overrideSource: `${overridePath}#pokemon.${pokemon.slug}.recommendedItems.${overrideItem.itemSlug}`,
        overrideField: field,
        roleFitScore: recommendationRoleFitScore(matchedPreferenceTerms, item),
      },
    ];
  });
}

function evaluateOverrideHarmony(
  pokemonPrimaryColor: string,
  itemPrimaryColor: string | null,
  isDyeable: boolean,
): Pick<RecommendationEntryDraft, "harmonyStatus" | "harmonyType"> {
  if (isDyeable) {
    return { harmonyStatus: "not_required", harmonyType: null };
  }
  if (itemPrimaryColor && isHexColor(pokemonPrimaryColor) && isHexColor(itemPrimaryColor)) {
    const harmony = evaluateOklchHarmony(pokemonPrimaryColor, itemPrimaryColor);
    if (harmony.harmonyStatus === "passed" && harmony.harmonyType) {
      return { harmonyStatus: "passed", harmonyType: harmony.harmonyType };
    }
  }
  return { harmonyStatus: "override", harmonyType: null };
}

function applyRecommendedItemsOverride(
  automaticDrafts: RecommendationEntryDraft[],
  overrideDrafts: RecommendationEntryDraft[],
  mode: PokemonRecommendedItemsOverride["mode"] | undefined,
  pokemonSlug: string,
  overridePath: string,
  issues: RecommendationDataBuildIssue[],
): RecommendationEntryDraft[] {
  if (!mode) {
    return automaticDrafts;
  }
  if (mode === "replace") {
    return overrideDrafts;
  }

  const draftsBySlug = new Map(automaticDrafts.map((draft) => [draft.itemSlug, draft]));
  overrideDrafts.forEach((draft) => {
    if (draftsBySlug.has(draft.itemSlug)) {
      issues.push({
        file: overridePath,
        field: draft.overrideField,
        pokemonSlug,
        itemSlug: draft.itemSlug,
        message: "Recommended item override duplicates an automatic recommendation in append mode",
      });
      return;
    }
    draftsBySlug.set(draft.itemSlug, draft);
  });
  return Array.from(draftsBySlug.values());
}

function recommendationRoleFitScore(matchedPreferenceTerms: string[], item: RecommendationBuildCompactItem): number {
  const itemRoleTerms = new Set(item.recommendation.roleTags.map(toPreferenceTerm));
  return matchedPreferenceTerms.filter((term) => itemRoleTerms.has(toPreferenceTerm(term))).length;
}

function harmonyPriority(type: NonNullable<RecommendationEntry["harmonyType"]>): number {
  switch (type) {
    case "complementary":
      return 1;
    case "splitComplementary":
      return 2;
    case "analogous":
      return 3;
    case "triadic":
      return 4;
    case "monochrome":
      return 5;
  }
}

function normalizePreferenceTerms(values: string[]): string[] {
  return Array.from(new Set(values.map(toPreferenceTerm).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

function toPreferenceTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value);
}
