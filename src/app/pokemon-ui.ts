export const POKEMON_RANGES = ["all", "early", "late"] as const;

export type PokemonRange = (typeof POKEMON_RANGES)[number];

export type PokemonSearchRecord = {
  sequence: string;
  name: string;
  zh: string;
  slug: string;
};

export function isPokemonRange(value: string | undefined): value is PokemonRange {
  return value !== undefined && POKEMON_RANGES.includes(value as PokemonRange);
}

export function filterPokemon<T extends PokemonSearchRecord>(
  pokemon: T[],
  query: string,
  range: PokemonRange,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  return pokemon.filter((entry) => {
    const sequence = Number(entry.sequence);
    const matchesRange =
      range === "all" ||
      (range === "early" && sequence <= 120) ||
      (range === "late" && sequence > 120);
    const haystack = `${entry.sequence} ${entry.name} ${entry.zh} ${entry.slug}`.toLowerCase();
    return matchesRange && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}

export function pokemonAltText(pokemon: Pick<PokemonSearchRecord, "zh" | "name">): string {
  return `${pokemon.zh} ${pokemon.name}`.trim();
}
