import { evaluateOklchHarmony, type HarmonyType } from "./color-harmony.js";

export type CandidateExclusionReason =
  | "pokemon_has_no_preference_terms"
  | "no_preference_match"
  | "unknown_dyeable_status";

export type RecommendationRejectionReason =
  | "harmony_failed"
  | "missing_item_primary_color"
  | "missing_pokemon_primary_color"
  | "invalid_primary_color";

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

export type ItemColorLookup = {
  itemSlug: string;
  itemPrimaryColor: string | null;
};

export type HarmonyRecommendation = RecommendationCandidate & {
  harmonyStatus: "not_required" | "passed";
  harmonyType: HarmonyType | null;
  harmonySource: "dyeable" | "docs/oklch_color.ts";
  itemPrimaryColor: string | null;
};

export type RejectedHarmonyCandidate = RecommendationCandidate & {
  reason: RecommendationRejectionReason;
  itemPrimaryColor: string | null;
  harmonyStatus: "failed";
  harmonyType: null;
};

export type HarmonySelectionResult = {
  pokemonSlug: string;
  recommendations: HarmonyRecommendation[];
  rejected: RejectedHarmonyCandidate[];
};

export type RecommendationRankingInput = {
  itemSlug: string;
  matchedPreferenceTerms: string[];
  isDyeable: boolean;
  harmonyStatus: "not_required" | "passed";
  harmonyType: HarmonyType | null;
  overrideSource: string | null;
  roleFitScore?: number;
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

export function applyHarmonyToCandidates(
  pokemonSlug: string,
  pokemonPrimaryColor: string | null,
  candidates: RecommendationCandidate[],
  itemColors: ItemColorLookup[],
): HarmonySelectionResult {
  const colorBySlug = new Map(itemColors.map((item) => [item.itemSlug, item.itemPrimaryColor]));
  const recommendations: HarmonyRecommendation[] = [];
  const rejected: RejectedHarmonyCandidate[] = [];

  candidates.forEach((candidate) => {
    const itemPrimaryColor = colorBySlug.get(candidate.itemSlug) ?? null;

    if (!candidate.requiresHarmonyCheck) {
      recommendations.push({
        ...candidate,
        harmonyStatus: "not_required",
        harmonyType: null,
        harmonySource: "dyeable",
        itemPrimaryColor,
      });
      return;
    }

    if (!pokemonPrimaryColor) {
      rejected.push(failedHarmonyCandidate(candidate, "missing_pokemon_primary_color", itemPrimaryColor));
      return;
    }

    if (!itemPrimaryColor) {
      rejected.push(failedHarmonyCandidate(candidate, "missing_item_primary_color", itemPrimaryColor));
      return;
    }

    if (!isHexColor(pokemonPrimaryColor) || !isHexColor(itemPrimaryColor)) {
      rejected.push(failedHarmonyCandidate(candidate, "invalid_primary_color", itemPrimaryColor));
      return;
    }

    const harmony = evaluateOklchHarmony(pokemonPrimaryColor, itemPrimaryColor);
    if (harmony.harmonyStatus === "passed" && harmony.harmonyType) {
      recommendations.push({
        ...candidate,
        harmonyStatus: "passed",
        harmonyType: harmony.harmonyType,
        harmonySource: harmony.source,
        itemPrimaryColor,
      });
    } else {
      rejected.push(failedHarmonyCandidate(candidate, "harmony_failed", itemPrimaryColor));
    }
  });

  return { pokemonSlug, recommendations, rejected };
}

export function buildRecommendationResults(
  pokemon: PokemonPreferenceProfile,
  pokemonPrimaryColor: string | null,
  items: RecommendationItemInput[],
  itemColors: ItemColorLookup[],
): RecommendationCandidateResult & HarmonySelectionResult {
  const candidateResult = selectRecommendationCandidates(pokemon, items);
  const harmonyResult = applyHarmonyToCandidates(pokemon.slug, pokemonPrimaryColor, candidateResult.candidates, itemColors);

  return {
    ...candidateResult,
    ...harmonyResult,
  };
}

export function rankRecommendationEntries<T extends RecommendationRankingInput>(entries: T[]): T[] {
  return entries.slice().sort(compareRecommendationRank);
}

export function compareRecommendationRank(left: RecommendationRankingInput, right: RecommendationRankingInput): number {
  return (
    overridePriority(left) - overridePriority(right) ||
    right.matchedPreferenceTerms.length - left.matchedPreferenceTerms.length ||
    dyeablePriority(left) - dyeablePriority(right) ||
    harmonyPriority(left) - harmonyPriority(right) ||
    (right.roleFitScore ?? 0) - (left.roleFitScore ?? 0) ||
    left.itemSlug.localeCompare(right.itemSlug, "en")
  );
}

function failedHarmonyCandidate(
  candidate: RecommendationCandidate,
  reason: RecommendationRejectionReason,
  itemPrimaryColor: string | null,
): RejectedHarmonyCandidate {
  return {
    ...candidate,
    reason,
    itemPrimaryColor,
    harmonyStatus: "failed",
    harmonyType: null,
  };
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
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

function overridePriority(entry: RecommendationRankingInput): number {
  return entry.overrideSource ? 0 : 1;
}

function dyeablePriority(entry: RecommendationRankingInput): number {
  return entry.isDyeable ? 0 : 1;
}

function harmonyPriority(entry: RecommendationRankingInput): number {
  if (entry.harmonyStatus === "not_required") {
    return 0;
  }

  switch (entry.harmonyType) {
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
    default:
      return 6;
  }
}
