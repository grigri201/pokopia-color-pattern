import {
  RECOMMENDATIONS_SCHEMA_VERSION,
  type CompactItem,
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
  rankRecommendationEntries,
  toPokemonPreferenceProfile,
  type ItemColorLookup,
  type RecommendationItemInput,
  type RecommendationRankingInput,
} from "./recommendation.js";

export const RECOMMENDATION_PAGE_SIZE = 10 as const;

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

type RecommendationEntryDraft = Omit<RecommendationEntry, "rank" | "pageIndex"> &
  RecommendationRankingInput & {
    roleFitScore: number;
    overrideField?: string;
  };

export function buildRecommendationDataSet(
  pokemon: PokemonIndexEntry[],
  compactItems: CompactItem[],
  itemColors: ItemColorEntry[],
  options: RecommendationDataSetOptions = {},
): { recommendations: RecommendationsData[]; issues: RecommendationDataBuildIssue[] } {
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
  }));
  const issues: RecommendationDataBuildIssue[] = [];

  const recommendations = pokemon.map((pokemonEntry): RecommendationsData => {
    const result = buildRecommendationResults(
      toPokemonPreferenceProfile(pokemonEntry),
      pokemonEntry.primaryColor,
      recommendationInputs,
      itemColorLookup,
    );
    const automaticDrafts: RecommendationEntryDraft[] = [];

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

      automaticDrafts.push({
        itemSlug: recommendation.itemSlug,
        itemName: item.name,
        itemZhName: item.nameZh,
        itemImagePath: item.imagePath,
        category: item.category,
        matchedPreferenceTerms: recommendation.matchedPreferenceTerms,
        isDyeable: recommendation.isDyeable,
        pokemonPrimaryColor: pokemonEntry.primaryColor,
        itemPrimaryColor: recommendation.itemPrimaryColor,
        harmonyStatus: recommendation.harmonyStatus,
        harmonyType: recommendation.harmonyType,
        overrideSource: null,
        roleFitScore: recommendationRoleFitScore(recommendation.matchedPreferenceTerms, item),
      });
    });

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
    const drafts = applyRecommendedItemsOverride(
      automaticDrafts,
      overrideDrafts,
      recommendationOverride?.mode,
      pokemonEntry.slug,
      options.overridePath ?? "data/overrides/pokemon-metadata.json",
      issues,
    );

    const recommendations = rankRecommendationEntries(drafts).map(({ roleFitScore: _roleFitScore, overrideField: _overrideField, ...entry }, index) => ({
      ...entry,
      rank: index + 1,
      pageIndex: Math.floor(index / RECOMMENDATION_PAGE_SIZE),
    }));

    return {
      schemaVersion: RECOMMENDATIONS_SCHEMA_VERSION,
      pokemonSlug: pokemonEntry.slug,
      pageSize: RECOMMENDATION_PAGE_SIZE,
      totalPages: Math.ceil(recommendations.length / RECOMMENDATION_PAGE_SIZE),
      recommendations,
    };
  });

  return { recommendations, issues };
}

function buildOverrideRecommendationDrafts(
  pokemon: PokemonIndexEntry,
  recommendationOverride: PokemonRecommendedItemsOverride,
  compactBySlug: Map<string, CompactItem>,
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
        itemName: item.name,
        itemZhName: item.nameZh,
        itemImagePath: item.imagePath,
        category: item.category,
        matchedPreferenceTerms,
        isDyeable: item.recommendation.isDyeable,
        pokemonPrimaryColor: pokemon.primaryColor,
        itemPrimaryColor,
        harmonyStatus: harmony.harmonyStatus,
        harmonyType: harmony.harmonyType,
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

function recommendationRoleFitScore(matchedPreferenceTerms: string[], item: CompactItem): number {
  const itemRoleTerms = new Set(item.recommendation.roleTags.map(toPreferenceTerm));
  return matchedPreferenceTerms.filter((term) => itemRoleTerms.has(toPreferenceTerm(term))).length;
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
