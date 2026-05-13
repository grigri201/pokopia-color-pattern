import {
  RECOMMENDATIONS_SCHEMA_VERSION,
  type CompactItem,
  type ItemColorEntry,
  type PokemonIndexEntry,
  type RecommendationEntry,
  type RecommendationsData,
} from "../data/schemas.js";
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
  pokemonSlug: string;
  itemSlug?: string;
  message: string;
};

type RecommendationEntryDraft = Omit<RecommendationEntry, "rank" | "pageIndex"> &
  RecommendationRankingInput & {
    roleFitScore: number;
  };

export function buildRecommendationDataSet(
  pokemon: PokemonIndexEntry[],
  compactItems: CompactItem[],
  itemColors: ItemColorEntry[],
): { recommendations: RecommendationsData[]; issues: RecommendationDataBuildIssue[] } {
  const compactBySlug = new Map(compactItems.map((item) => [item.slug, item]));
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
    const drafts: RecommendationEntryDraft[] = [];

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

      drafts.push({
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

    const recommendations = rankRecommendationEntries(drafts).map(({ roleFitScore: _roleFitScore, ...entry }, index) => ({
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

function recommendationRoleFitScore(matchedPreferenceTerms: string[], item: CompactItem): number {
  const itemRoleTerms = new Set(item.recommendation.roleTags.map(toPreferenceTerm));
  return matchedPreferenceTerms.filter((term) => itemRoleTerms.has(toPreferenceTerm(term))).length;
}

function toPreferenceTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
