import { readFile } from "node:fs/promises";
import { filterPokemon, pokemonAltText } from "../src/app/pokemon-ui.js";
import { validatePokemonIndexData, type PokemonIndexData } from "../src/data/schemas.js";

const pokemonIndexPath = "generated/data/pokemon-index.json";
const pokemonIndex = JSON.parse(await readFile(pokemonIndexPath, "utf8")) as PokemonIndexData;
const issues = validatePokemonIndexData(pokemonIndex);

if (issues.length > 0) {
  throw new Error(`Invalid Pokemon index for Story 1.4 smoke: ${JSON.stringify(issues.slice(0, 3))}`);
}

const pokemon = pokemonIndex.pokemon.map((entry) => ({
  sequence: entry.sequence,
  name: entry.name,
  zh: entry.zhName || entry.name,
  slug: entry.slug,
  palette: entry.palette,
  imagePath: entry.imagePath,
}));

assertSearch("百变怪", "all", "ditto");
assertSearch("Ditto", "all", "ditto");
assertSearch("047", "all", "ditto");
assertSearch("Ditto", "early", "ditto");
assertSearch("Abra", "late", "abra");
assertSearch("Greninja", "late", "greninja");
assertExcludes("Abra", "early", "abra");
assertExcludes("Ditto", "late", "ditto");

["ditto", "abra", "greninja"].forEach((slug) => {
  const entry = pokemon.find((item) => item.slug === slug);
  if (!entry) {
    throw new Error(`Expected smoke Pokemon to exist: ${slug}`);
  }
  if (!entry.imagePath.startsWith("/assets/runtime/pokemon/")) {
    throw new Error(`Expected runtime Pokemon image path for ${slug}`);
  }
  if (!entry.palette.length || !entry.palette[0]?.hex || typeof entry.palette[0].percent !== "number") {
    throw new Error(`Expected generated palette for ${slug}`);
  }
  if (!pokemonAltText(entry).includes(entry.name) || !pokemonAltText(entry).includes(entry.zh)) {
    throw new Error(`Expected alt text to contain both names for ${slug}`);
  }
});

const indexHtml = await readFile("index.html", "utf8");
[
  'aria-label="搜索 Pokemon 名称、英文名或编号"',
  'aria-live="polite"',
  'aria-pressed="true"',
  'aria-pressed="false"',
].forEach((needle) => {
  if (!indexHtml.includes(needle)) {
    throw new Error(`Expected index.html accessibility marker: ${needle}`);
  }
});

console.log("Validated Story 1.4 Pokemon search, palette, alt text, and accessibility smoke.");

function assertSearch(query: string, range: "all" | "early" | "late", expectedSlug: string): void {
  const result = filterPokemon(pokemon, query, range);
  if (!result.some((entry) => entry.slug === expectedSlug)) {
    throw new Error(`Expected query "${query}" in range "${range}" to include ${expectedSlug}`);
  }
}

function assertExcludes(query: string, range: "all" | "early" | "late", excludedSlug: string): void {
  const result = filterPokemon(pokemon, query, range);
  if (result.some((entry) => entry.slug === excludedSlug)) {
    throw new Error(`Expected query "${query}" in range "${range}" to exclude ${excludedSlug}`);
  }
}
