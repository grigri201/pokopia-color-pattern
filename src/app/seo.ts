export const SITE_NAME = "Pokopia Decor Dex";
export const SITE_ORIGIN = "https://decor-dex.pokokit.com";
export const SITE_SEO_TITLE = "Pokopia Decor Dex - Pokemon Color Palettes and Decor Matches";
export const SITE_DESCRIPTION =
  "Explore Pokemon Pokopia color palettes, pattern grids, and decor recommendations for furniture, blocks, toys, food, and nature items.";
export const SITE_KEYWORDS = [
  "Pokemon Pokopia",
  "Pokopia decor",
  "Pokemon color palette",
  "decor recommendations",
  "furniture matches",
  "item color matches",
].join(", ");

export type PokemonSeoDescriptionInput = {
  name: string;
  primaryColor: string;
  patternCount: number;
  recommendationNames?: string[];
  recommendationStatus?: "ready" | "empty" | "missing";
};

export function pokemonSeoTitle(name: string): string {
  return `${name} Color Palette and Decor Matches | ${SITE_NAME}`;
}

export function pokemonSeoDescription(input: PokemonSeoDescriptionInput): string {
  const recommendationNames = input.recommendationNames?.filter(Boolean).slice(0, 3) ?? [];
  if (recommendationNames.length > 0) {
    return `Explore the Pokemon Pokopia color palette for ${input.name} (${input.primaryColor}), ${input.patternCount} pattern colors, and decor matches including ${recommendationNames.join(", ")}.`;
  }
  if (input.recommendationStatus === "missing") {
    return `Explore the Pokemon Pokopia color palette for ${input.name} (${input.primaryColor}), ${input.patternCount} pattern colors, and static Decor Dex profile while match data is regenerated.`;
  }
  if (input.recommendationStatus === "empty") {
    return `Explore the Pokemon Pokopia color palette for ${input.name} (${input.primaryColor}), ${input.patternCount} pattern colors, and Decor Dex profile while match rules expand.`;
  }
  return `Explore the Pokemon Pokopia color palette for ${input.name} (${input.primaryColor}), ${input.patternCount} pattern colors, and decor match profile.`;
}
