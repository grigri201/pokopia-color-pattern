export type CandidateExclusionReason =
  | "pokemon_has_no_preference_terms"
  | "no_preference_match"
  | "unknown_dyeable_status";

export type RecommendationItemInput = {
  slug: string;
  name: string;
  category: string | null;
  tags: string[];
  preferenceTerms: string[];
  roleTags: string[];
  isDyeable: boolean | null;
};

export type PokemonPreferenceProfile = {
  slug: string;
  preferenceTerms: string[];
  preferenceSource: "metadata" | "override" | "fixture" | "none";
};

export type PokemonPreferenceMetadata = {
  slug: string;
  preferenceTerms: string[];
  preferenceSource: "metadata" | "override" | null;
};

export type RecommendationCandidate = {
  itemSlug: string;
  matchedPreferenceTerms: string[];
  isDyeable: boolean;
  requiresHarmonyCheck: boolean;
  candidateStatus: "eligible" | "needs_harmony";
};

export type ExcludedRecommendationCandidate = {
  itemSlug: string;
  reason: CandidateExclusionReason;
  preferenceTerms: string[];
};

export type RecommendationCandidateResult = {
  pokemonSlug: string;
  candidates: RecommendationCandidate[];
  excluded: ExcludedRecommendationCandidate[];
};

export function selectRecommendationCandidates(
  pokemon: PokemonPreferenceProfile,
  items: RecommendationItemInput[],
): RecommendationCandidateResult {
  const preferenceTerms = normalizeTerms(pokemon.preferenceTerms);
  const candidates: RecommendationCandidate[] = [];
  const excluded: ExcludedRecommendationCandidate[] = [];

  items.forEach((item) => {
    if (preferenceTerms.length === 0) {
      excluded.push({
        itemSlug: item.slug,
        reason: "pokemon_has_no_preference_terms",
        preferenceTerms: [],
      });
      return;
    }

    const matchedPreferenceTerms = matchPreferenceTerms(preferenceTerms, item);
    if (matchedPreferenceTerms.length === 0) {
      excluded.push({
        itemSlug: item.slug,
        reason: "no_preference_match",
        preferenceTerms,
      });
      return;
    }

    if (item.isDyeable === null) {
      excluded.push({
        itemSlug: item.slug,
        reason: "unknown_dyeable_status",
        preferenceTerms,
      });
      return;
    }

    candidates.push({
      itemSlug: item.slug,
      matchedPreferenceTerms,
      isDyeable: item.isDyeable,
      requiresHarmonyCheck: !item.isDyeable,
      candidateStatus: item.isDyeable ? "eligible" : "needs_harmony",
    });
  });

  return { pokemonSlug: pokemon.slug, candidates, excluded };
}

export function toPokemonPreferenceProfile(metadata: PokemonPreferenceMetadata): PokemonPreferenceProfile {
  return {
    slug: metadata.slug,
    preferenceTerms: metadata.preferenceTerms,
    preferenceSource: metadata.preferenceSource ?? "none",
  };
}

function matchPreferenceTerms(preferenceTerms: string[], item: RecommendationItemInput): string[] {
  const searchText = normalizeSearchText([
    item.slug,
    item.name,
    item.category ?? "",
    ...item.tags,
    ...item.preferenceTerms,
    ...item.roleTags,
  ]);

  return preferenceTerms.filter((term) => includesTerm(searchText, term));
}

function normalizeTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.map(normalizeTerm).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

function normalizeSearchText(values: string[]): string {
  return ` ${values.map(normalizeTerm).filter(Boolean).join(" ")} `;
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function includesTerm(searchText: string, term: string): boolean {
  return new RegExp(`(^| )${escapeRegExp(term)}( |$)`).test(searchText);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
