import {
  applyHarmonyToCandidates,
  buildRecommendationResults,
  rankRecommendationEntries,
  selectRecommendationCandidates,
  toPokemonPreferenceProfile,
  type RecommendationItemInput,
  type RecommendationRankingInput,
} from "../src/domain/recommendation.js";
import { buildRecommendationDataSet, type RecommendationBuildCompactItem } from "../src/domain/recommendation-data.js";
import {
  RECOMMENDATIONS_SCHEMA_VERSION,
  validateCompactItemsData,
  validateRecommendationsData,
  type ItemColorEntry,
  type PokemonIndexEntry,
  type RecommendationsData,
} from "../src/data/schemas.js";
import { getHarmonyColors } from "../docs/oklch_color.js";

const pokemon = toPokemonPreferenceProfile({
  slug: "fixture-mon",
  bodySize: "other",
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
    furnitureSize: "other",
  },
  {
    slug: "wooden-lamp",
    name: "Wooden lamp",
    category: "Decoration",
    tags: ["Light"],
    preferenceTerms: [],
    roleTags: ["decoration"],
    isDyeable: false,
    furnitureSize: null,
  },
  {
    slug: "iron-box",
    name: "Iron box",
    category: "Furniture",
    tags: ["Storage"],
    preferenceTerms: [],
    roleTags: ["furniture"],
    isDyeable: true,
    furnitureSize: "other",
  },
  {
    slug: "flower-mystery",
    name: "Flower mystery",
    category: "Decoration",
    tags: [],
    preferenceTerms: [],
    roleTags: [],
    isDyeable: null,
    furnitureSize: null,
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
  { slug: "empty-profile", bodySize: "other", preferenceTerms: ["!!!"], preferenceSource: "fixture" },
  [items[0]],
);
if (noPreferenceResult.excluded[0]?.reason !== "pokemon_has_no_preference_terms") {
  throw new Error("Expected missing Pokemon preference terms to produce pokemon_has_no_preference_terms");
}

const substringResult = selectRecommendationCandidates(
  { slug: "substring-profile", bodySize: "other", preferenceTerms: ["wood"], preferenceSource: "fixture" },
  [
    {
      slug: "wooden-lamp",
      name: "Wooden lamp",
      category: "Decoration",
      tags: [],
      preferenceTerms: [],
      roleTags: [],
      isDyeable: true,
      furnitureSize: null,
    },
  ],
);
if (substringResult.candidates.length > 0) {
  throw new Error("Expected preference term wood not to match substring in wooden-lamp");
}

const bodySizeResult = selectRecommendationCandidates(
  { slug: "large-profile", bodySize: "large", preferenceTerms: ["wooden"], preferenceSource: "fixture" },
  [
    {
      slug: "plain-chair",
      name: "Plain chair",
      category: "Furniture",
      tags: ["Relaxation"],
      preferenceTerms: ["wooden stuff"],
      roleTags: ["furniture"],
      isDyeable: true,
      furnitureSize: "other",
    },
    {
      slug: "large-table",
      name: "Large table",
      category: "Furniture",
      tags: [],
      preferenceTerms: ["wooden stuff"],
      roleTags: ["furniture"],
      isDyeable: true,
      furnitureSize: "large",
    },
  ],
);
if (bodySizeResult.candidates.some((item) => item.itemSlug === "plain-chair")) {
  throw new Error("Expected large Pokemon to exclude other-size furniture");
}
const bodySizeExcluded = bodySizeResult.excluded.find((item) => item.itemSlug === "plain-chair");
if (!bodySizeExcluded || bodySizeExcluded.reason !== "furniture_size_mismatch") {
  throw new Error(`Expected furniture_size_mismatch for plain-chair: ${JSON.stringify(bodySizeResult)}`);
}
if (!bodySizeResult.candidates.some((item) => item.itemSlug === "large-table")) {
  throw new Error("Expected large Pokemon to keep large furniture");
}

const pokemonPrimaryColor = "#D05A6E";
const harmony = getHarmonyColors(pokemonPrimaryColor);
const harmonyResult = applyHarmonyToCandidates("fixture-mon", pokemonPrimaryColor, result.candidates, [
  { itemSlug: "flower-chair", itemPrimaryColor: "#00FF00" },
  { itemSlug: "wooden-lamp", itemPrimaryColor: harmony.complementary },
]);
const dyeableRecommendation = harmonyResult.recommendations.find((item) => item.itemSlug === "flower-chair");
if (!dyeableRecommendation || dyeableRecommendation.harmonyStatus !== "not_required") {
  throw new Error("Expected dyeable candidate to bypass OKLCH harmony filtering");
}
const nonDyeableRecommendation = harmonyResult.recommendations.find((item) => item.itemSlug === "wooden-lamp");
if (
  !nonDyeableRecommendation ||
  nonDyeableRecommendation.harmonyStatus !== "passed" ||
  nonDyeableRecommendation.harmonyType !== "complementary"
) {
  throw new Error("Expected non-dyeable harmonious candidate to pass with harmony fields");
}

const failedHarmony = applyHarmonyToCandidates("fixture-mon", pokemonPrimaryColor, result.candidates, [
  { itemSlug: "flower-chair", itemPrimaryColor: "#00FF00" },
  { itemSlug: "wooden-lamp", itemPrimaryColor: "#00FF00" },
]);
const rejectedHarmony = failedHarmony.rejected.find((item) => item.itemSlug === "wooden-lamp");
if (!rejectedHarmony || rejectedHarmony.reason !== "harmony_failed") {
  throw new Error("Expected non-dyeable non-harmonious candidate to be rejected with harmony_failed");
}

const combinedResult = buildRecommendationResults(pokemon, pokemonPrimaryColor, items, [
  { itemSlug: "flower-chair", itemPrimaryColor: "#00FF00" },
  { itemSlug: "wooden-lamp", itemPrimaryColor: "#00FF00" },
  { itemSlug: "flower-mystery", itemPrimaryColor: "#00FF00" },
]);
if (combinedResult.recommendations.some((item) => item.itemSlug === "wooden-lamp")) {
  throw new Error("Expected combined recommendation entrypoint to reject non-harmonious non-dyeable item");
}

const missingPokemonColor = applyHarmonyToCandidates("fixture-mon", null, result.candidates, [
  { itemSlug: "wooden-lamp", itemPrimaryColor: harmony.complementary },
]);
if (missingPokemonColor.rejected.find((item) => item.itemSlug === "wooden-lamp")?.reason !== "missing_pokemon_primary_color") {
  throw new Error("Expected missing Pokemon primary color to reject harmony-required candidates");
}

const invalidItemColor = applyHarmonyToCandidates("fixture-mon", pokemonPrimaryColor, result.candidates, [
  { itemSlug: "wooden-lamp", itemPrimaryColor: "bad-color" },
]);
if (invalidItemColor.rejected.find((item) => item.itemSlug === "wooden-lamp")?.reason !== "invalid_primary_color") {
  throw new Error("Expected invalid item primary color to reject harmony-required candidates");
}

const rankedFixture: RecommendationRankingInput[] = [
  {
    itemSlug: "z-slug",
    matchedPreferenceTerms: ["flower"],
    isDyeable: true,
    harmonyStatus: "not_required",
    harmonyType: null,
    overrideSource: null,
  },
  {
    itemSlug: "override-item",
    matchedPreferenceTerms: ["flower"],
    isDyeable: false,
    harmonyStatus: "passed",
    harmonyType: "monochrome",
    overrideSource: "fixture#override",
  },
  {
    itemSlug: "multi-term",
    matchedPreferenceTerms: ["flower", "garden"],
    isDyeable: false,
    harmonyStatus: "passed",
    harmonyType: "analogous",
    overrideSource: null,
  },
  {
    itemSlug: "a-slug",
    matchedPreferenceTerms: ["flower"],
    isDyeable: true,
    harmonyStatus: "not_required",
    harmonyType: null,
    overrideSource: null,
  },
  {
    itemSlug: "complementary-item",
    matchedPreferenceTerms: ["flower"],
    isDyeable: false,
    harmonyStatus: "passed",
    harmonyType: "complementary",
    overrideSource: null,
  },
];
const rankedSlugs = rankRecommendationEntries(rankedFixture).map((entry) => entry.itemSlug);
const expectedRankedSlugs = ["multi-term", "a-slug", "z-slug", "complementary-item", "override-item"];
if (rankedSlugs.join(",") !== expectedRankedSlugs.join(",")) {
  throw new Error(`Unexpected recommendation ranking order: ${rankedSlugs.join(",")}`);
}

const recommendationDataFixture: RecommendationsData = {
  schemaVersion: RECOMMENDATIONS_SCHEMA_VERSION,
  pokemonSlug: "fixture-mon",
  pageSize: 10,
  totalPages: 1,
  recommendations: [
    {
      itemSlug: "flower-chair",
      matchedPreferenceTerms: ["flower"],
      harmonyStatus: "not_required",
      harmonyType: null,
      recommendedDyeColors: ["red"],
      overrideSource: null,
      rank: 1,
      pageIndex: 0,
    },
  ],
};
const schemaIssues = validateRecommendationsData(recommendationDataFixture);
if (schemaIssues.length > 0) {
  throw new Error(`Expected recommendation data fixture to pass schema: ${JSON.stringify(schemaIssues)}`);
}
const legacyRecommendationIssues = validateRecommendationsData({
  ...recommendationDataFixture,
  recommendations: [
    {
      ...recommendationDataFixture.recommendations[0],
      itemName: "Flower chair",
      itemImagePath: "/assets/runtime/items/flower-chair.webp",
      category: "Furniture",
      isDyeable: true,
      pokemonPrimaryColor,
      itemPrimaryColor: "#00FF00",
    },
  ],
});
if (!legacyRecommendationIssues.some((issue) => issue.message === "Unexpected runtime field")) {
  throw new Error(`Expected legacy recommendation fields to fail schema: ${JSON.stringify(legacyRecommendationIssues)}`);
}

const pokemonDataFixture: PokemonIndexEntry[] = [
  {
    slug: "fixture-mon",
    sequence: "1",
    name: "Fixture Mon",
    zhName: null,
    bodySize: "other",
    imagePath: "/assets/runtime/pokemon/fixture-mon.webp",
    primaryColor: pokemonPrimaryColor,
    palette: [{ hex: pokemonPrimaryColor, percent: 100 }],
    colorSource: "override",
    fallbackReason: null,
    overrideSource: "fixture#pokemon.fixture-mon",
    pattern: [pokemonPrimaryColor],
    preferenceTerms: ["flower", "garden"],
    preferenceSource: "override",
  },
];
const compactDataFixture: RecommendationBuildCompactItem[] = [
  compactItemFixture("flower-chair", "Flower chair", true),
  compactItemFixture("flower-garden-lamp", "Flower garden lamp", false, ["Garden"], ["decoration", "garden"]),
  compactItemFixture("flower-bad-stone", "Flower bad stone", false),
  compactItemFixture("flower-vase", "Flower vase", false),
  compactItemFixture("manual-rock", "Manual rock", false),
];
const compactRuntimeFixture = {
  schemaVersion: "compact-items.v4",
  summary: { itemCount: 1, categoryCounts: { Decoration: 1 }, tagCounts: {} },
  items: [
    {
      slug: "flower-chair",
      name: "Flower chair",
      nameZh: null,
      category: "Decoration",
      tags: [],
      imagePath: "/assets/runtime/items/flower-chair.webp",
      sourceRow: 1,
      recommendation: {
        isDyeable: true,
        dyeColorVariants: ["red"],
        itemPrimaryColor: "#00FF00",
        furnitureSize: null,
        preferenceTerms: ["flower"],
      },
    },
  ],
};
const legacyCompactIssues = validateCompactItemsData(compactRuntimeFixture);
if (!legacyCompactIssues.some((issue) => issue.message === "Unexpected runtime field")) {
  throw new Error(`Expected legacy compact item fields to fail schema: ${JSON.stringify(legacyCompactIssues)}`);
}
const itemColorDataFixture: ItemColorEntry[] = [
  { slug: "flower-chair", itemPrimaryColor: "#00FF00", colorSource: "extracted", fallbackReason: null },
  { slug: "flower-garden-lamp", itemPrimaryColor: harmony.complementary, colorSource: "extracted", fallbackReason: null },
  { slug: "flower-bad-stone", itemPrimaryColor: "#00FF00", colorSource: "extracted", fallbackReason: null },
  { slug: "flower-vase", itemPrimaryColor: harmony.analogous[0], colorSource: "extracted", fallbackReason: null },
  { slug: "manual-rock", itemPrimaryColor: "#00FF00", colorSource: "extracted", fallbackReason: null },
];
const builtData = buildRecommendationDataSet(pokemonDataFixture, compactDataFixture, itemColorDataFixture);
if (builtData.issues.length > 0) {
  throw new Error(`Expected recommendation data builder fixture to have no issues: ${JSON.stringify(builtData.issues)}`);
}
if (builtData.diagnostics.schemaVersion !== "recommendation-diagnostics.v1") {
  throw new Error(`fixture-mon diagnostics report branch failed: ${JSON.stringify(builtData.diagnostics)}`);
}
const builtDiagnostics = builtData.diagnostics.pokemon.find((entry) => entry.pokemonSlug === "fixture-mon");
if (
  !builtDiagnostics ||
  builtDiagnostics.status !== "ready" ||
  builtDiagnostics.recommendationCount !== builtData.recommendations[0].recommendations.length ||
  builtDiagnostics.exclusionReasonCounts.no_preference_match === undefined ||
  builtDiagnostics.harmonyRejectionReasonCounts.harmony_failed === undefined
) {
  throw new Error(`fixture-mon diagnostics counts branch failed: ${JSON.stringify(builtDiagnostics)}`);
}
if (
  builtData.diagnostics.summary.readyCount !== 1 ||
  builtData.diagnostics.summary.emptyCount !== 0 ||
  builtData.diagnostics.summary.sparseCount !== 0 ||
  builtData.diagnostics.summary.totalRecommendations !== builtData.recommendations[0].recommendations.length
) {
  throw new Error(`fixture-mon diagnostics summary branch failed: ${JSON.stringify(builtData.diagnostics.summary)}`);
}
const builtFixture = builtData.recommendations[0];
const builtSchemaIssues = validateRecommendationsData(builtFixture);
if (builtSchemaIssues.length > 0) {
  throw new Error(`Expected built recommendation data fixture to pass schema: ${JSON.stringify(builtSchemaIssues)}`);
}
const firstBuiltEntry = builtFixture.recommendations[0];
if (
  !firstBuiltEntry ||
  firstBuiltEntry.itemSlug !== "flower-garden-lamp" ||
  firstBuiltEntry.rank !== 1 ||
  firstBuiltEntry.pageIndex !== 0 ||
  firstBuiltEntry.matchedPreferenceTerms.join(",") !== "flower,garden" ||
  firstBuiltEntry.overrideSource !== null
) {
  throw new Error(`Unexpected built recommendation data entry: ${JSON.stringify(firstBuiltEntry)}`);
}

const appendOverrideData = buildRecommendationDataSet(pokemonDataFixture, compactDataFixture, itemColorDataFixture, {
  overridePath: "fixture-overrides.json",
  overrides: {
    "fixture-mon": {
      recommendedItems: {
        mode: "append",
        items: [{ itemSlug: "manual-rock", matchedPreferenceTerms: ["manual"] }],
      },
    },
  },
});
if (appendOverrideData.issues.length > 0) {
  throw new Error(`Expected append override fixture to have no issues: ${JSON.stringify(appendOverrideData.issues)}`);
}
const appendRecommendations = appendOverrideData.recommendations[0].recommendations;
const appendedManualItem = appendRecommendations.find((entry) => entry.itemSlug === "manual-rock");
if (
  !appendedManualItem ||
  appendedManualItem.rank !== appendRecommendations.length ||
  appendedManualItem.pageIndex !== 0 ||
  appendedManualItem.overrideSource !== "fixture-overrides.json#pokemon.fixture-mon.recommendedItems.manual-rock" ||
  appendedManualItem.harmonyStatus !== "override" ||
  appendRecommendations.at(-1)?.itemSlug !== "manual-rock" ||
  !appendRecommendations.some((entry) => entry.itemSlug === "flower-garden-lamp")
) {
  throw new Error(`Unexpected append override recommendations: ${JSON.stringify(appendRecommendations)}`);
}
const appendSchemaIssues = validateRecommendationsData(appendOverrideData.recommendations[0]);
if (appendSchemaIssues.length > 0) {
  throw new Error(`Expected append override recommendations to pass schema: ${JSON.stringify(appendSchemaIssues)}`);
}

const duplicateAppendOverrideData = buildRecommendationDataSet(pokemonDataFixture, compactDataFixture, itemColorDataFixture, {
  overridePath: "fixture-overrides.json",
  overrides: {
    "fixture-mon": {
      recommendedItems: {
        mode: "append",
        items: [{ itemSlug: "flower-garden-lamp", matchedPreferenceTerms: ["manual"] }],
      },
    },
  },
});
const duplicateAppendIssue = duplicateAppendOverrideData.issues.find(
  (issue) =>
    issue.file === "fixture-overrides.json" &&
    issue.field === "$.pokemon.fixture-mon.recommendedItems.items[0].itemSlug" &&
    issue.message.includes("duplicates an automatic recommendation"),
);
if (!duplicateAppendIssue) {
  throw new Error(`Expected duplicate append override to fail with override field context: ${JSON.stringify(duplicateAppendOverrideData.issues)}`);
}

const unknownOverrideItemData = buildRecommendationDataSet(pokemonDataFixture, compactDataFixture, itemColorDataFixture, {
  overridePath: "fixture-overrides.json",
  overrides: {
    "fixture-mon": {
      recommendedItems: {
        mode: "replace",
        items: [{ itemSlug: "missing-item", matchedPreferenceTerms: ["manual"] }],
      },
    },
  },
});
const unknownOverrideIssue = unknownOverrideItemData.issues.find(
  (issue) =>
    issue.file === "fixture-overrides.json" &&
    issue.field === "$.pokemon.fixture-mon.recommendedItems.items[0].itemSlug" &&
    issue.itemSlug === "missing-item",
);
if (!unknownOverrideIssue) {
  throw new Error(`Expected unknown override item to fail with override field context: ${JSON.stringify(unknownOverrideItemData.issues)}`);
}

const replaceOverrideData = buildRecommendationDataSet(pokemonDataFixture, compactDataFixture, itemColorDataFixture, {
  overridePath: "fixture-overrides.json",
  overrides: {
    "fixture-mon": {
      recommendedItems: {
        mode: "replace",
        items: [{ itemSlug: "manual-rock", matchedPreferenceTerms: ["manual"] }],
      },
    },
  },
});
const replaceRecommendations = replaceOverrideData.recommendations[0].recommendations;
if (
  replaceOverrideData.issues.length > 0 ||
  replaceRecommendations.length !== 1 ||
  replaceRecommendations[0]?.itemSlug !== "manual-rock" ||
  replaceRecommendations[0].overrideSource !== "fixture-overrides.json#pokemon.fixture-mon.recommendedItems.manual-rock"
) {
  throw new Error(`Unexpected replace override recommendations: ${JSON.stringify(replaceOverrideData)}`);
}
const replaceSchemaIssues = validateRecommendationsData(replaceOverrideData.recommendations[0]);
if (replaceSchemaIssues.length > 0) {
  throw new Error(`Expected replace override recommendations to pass schema: ${JSON.stringify(replaceSchemaIssues)}`);
}

const untrackedOverrideStatusIssues = validateRecommendationsData({
  ...replaceOverrideData.recommendations[0],
  recommendations: [
    {
      ...replaceOverrideData.recommendations[0].recommendations[0],
      overrideSource: null,
    },
  ],
});
if (!untrackedOverrideStatusIssues.some((issue) => issue.path === "$.recommendations[0].overrideSource")) {
  throw new Error(`Expected override harmony status to require overrideSource: ${JSON.stringify(untrackedOverrideStatusIssues)}`);
}

const sparseRecommendationData = buildRecommendationDataSet(
  [
    {
      ...pokemonDataFixture[0],
      slug: "sparse-mon",
      preferenceTerms: ["flower"],
    },
  ],
  [compactItemFixture("flower-chair", "Flower chair", true)],
  [{ slug: "flower-chair", itemPrimaryColor: "#00FF00", colorSource: "extracted", fallbackReason: null }],
);
const sparseDiagnostics = sparseRecommendationData.diagnostics.pokemon[0];
if (
  sparseRecommendationData.recommendations[0].recommendations.length !== 1 ||
  sparseDiagnostics?.status !== "sparse" ||
  sparseDiagnostics.recommendationCount !== 1 ||
  sparseRecommendationData.diagnostics.summary.sparseCount !== 1
) {
  throw new Error(`sparse-mon diagnostics branch failed: ${JSON.stringify(sparseRecommendationData.diagnostics)}`);
}

const emptyRecommendationData = buildRecommendationDataSet(
  [
    {
      ...pokemonDataFixture[0],
      slug: "empty-mon",
      preferenceTerms: [],
      preferenceSource: null,
    },
  ],
  [compactItemFixture("flower-chair", "Flower chair", true)],
  [{ slug: "flower-chair", itemPrimaryColor: "#00FF00", colorSource: "extracted", fallbackReason: null }],
);
const emptyDiagnostics = emptyRecommendationData.diagnostics.pokemon[0];
if (
  emptyRecommendationData.recommendations[0].recommendations.length !== 1 ||
  emptyDiagnostics?.status !== "sparse" ||
  emptyDiagnostics.recommendationStrategy !== "dyeable_default" ||
  emptyDiagnostics.defaultDyeableRecommendationCount !== 1 ||
  Object.keys(emptyDiagnostics.exclusionReasonCounts).length !== 0 ||
  emptyRecommendationData.diagnostics.summary.sparseCount !== 1
) {
  throw new Error(`empty-mon dyeable default diagnostics branch failed: ${JSON.stringify(emptyRecommendationData.diagnostics)}`);
}
const emptyFallbackEntry = emptyRecommendationData.recommendations[0].recommendations[0];
if (
  emptyFallbackEntry?.itemSlug !== "flower-chair" ||
  emptyFallbackEntry.matchedPreferenceTerms.join(",") !== "decoration,dyeable"
) {
  throw new Error(`empty-mon dyeable default recommendation failed: ${JSON.stringify(emptyFallbackEntry)}`);
}

console.log("Validated recommendation candidate, harmony, ranking, and schema fixtures.");

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

function compactItemFixture(
  slug: string,
  name: string,
  isDyeable: boolean,
  tags: string[] = [],
  roleTags: string[] = ["decoration"],
): RecommendationBuildCompactItem {
  return {
    slug,
    name,
    nameZh: null,
    category: "Decoration",
    tags,
    imagePath: `/assets/runtime/items/${slug}.webp`,
    recommendation: {
      isDyeable,
      dyeColorVariants: isDyeable ? ["blue", "red"] : [],
      itemPrimaryColor: null,
      furnitureSize: null,
      preferenceTerms: [],
      roleTags,
    },
  };
}
