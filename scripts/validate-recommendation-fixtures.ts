import {
  selectRecommendationCandidates,
  toPokemonPreferenceProfile,
  type RecommendationItemInput,
} from "../src/domain/recommendation.js";

const pokemon = toPokemonPreferenceProfile({
  slug: "fixture-mon",
  preferenceTerms: ["flower", "wooden"],
  preferenceSource: "metadata",
});

const items: RecommendationItemInput[] = [
  {
    slug: "flower-chair",
    name: "Flower chair",
    category: "Furniture",
    tags: ["Relaxation"],
    preferenceTerms: [],
    roleTags: ["furniture"],
    isDyeable: true,
  },
  {
    slug: "wooden-lamp",
    name: "Wooden lamp",
    category: "Decoration",
    tags: ["Light"],
    preferenceTerms: [],
    roleTags: ["decoration"],
    isDyeable: false,
  },
  {
    slug: "iron-box",
    name: "Iron box",
    category: "Furniture",
    tags: ["Storage"],
    preferenceTerms: [],
    roleTags: ["furniture"],
    isDyeable: true,
  },
  {
    slug: "flower-mystery",
    name: "Flower mystery",
    category: "Decoration",
    tags: [],
    preferenceTerms: [],
    roleTags: [],
    isDyeable: null,
  },
];

const result = selectRecommendationCandidates(pokemon, items);

assertCandidate("flower-chair", {
  isDyeable: true,
  requiresHarmonyCheck: false,
  matchedPreferenceTerms: ["flower"],
});
assertCandidate("wooden-lamp", {
  isDyeable: false,
  requiresHarmonyCheck: true,
  matchedPreferenceTerms: ["wooden"],
});

const excluded = result.excluded.find((item) => item.itemSlug === "iron-box");
if (!excluded || excluded.reason !== "no_preference_match") {
  throw new Error("Expected iron-box to be excluded by the no_preference_match branch");
}

const unknownDyeable = result.excluded.find((item) => item.itemSlug === "flower-mystery");
if (!unknownDyeable || unknownDyeable.reason !== "unknown_dyeable_status") {
  throw new Error("Expected flower-mystery to be excluded by the unknown_dyeable_status branch");
}

const noPreferenceResult = selectRecommendationCandidates(
  { slug: "empty-profile", preferenceTerms: ["!!!"], preferenceSource: "fixture" },
  [items[0]],
);
if (noPreferenceResult.excluded[0]?.reason !== "pokemon_has_no_preference_terms") {
  throw new Error("Expected missing Pokemon preference terms to produce pokemon_has_no_preference_terms");
}

const substringResult = selectRecommendationCandidates(
  { slug: "substring-profile", preferenceTerms: ["wood"], preferenceSource: "fixture" },
  [
    {
      slug: "wooden-lamp",
      name: "Wooden lamp",
      category: "Decoration",
      tags: [],
      preferenceTerms: [],
      roleTags: [],
      isDyeable: true,
    },
  ],
);
if (substringResult.candidates.length > 0) {
  throw new Error("Expected preference term wood not to match substring in wooden-lamp");
}

console.log("Validated recommendation candidate preference and dyeable fixtures.");

function assertCandidate(
  itemSlug: string,
  expected: { isDyeable: boolean; requiresHarmonyCheck: boolean; matchedPreferenceTerms: string[] },
): void {
  const candidate = result.candidates.find((item) => item.itemSlug === itemSlug);
  if (!candidate) {
    throw new Error(`Expected ${itemSlug} to enter recommendation candidates`);
  }
  if (candidate.isDyeable !== expected.isDyeable || candidate.requiresHarmonyCheck !== expected.requiresHarmonyCheck) {
    throw new Error(`Unexpected dyeable branch for ${itemSlug}: ${JSON.stringify(candidate)}`);
  }
  if (candidate.matchedPreferenceTerms.join(",") !== expected.matchedPreferenceTerms.join(",")) {
    throw new Error(`Unexpected matched preference terms for ${itemSlug}: ${candidate.matchedPreferenceTerms.join(",")}`);
  }
}
