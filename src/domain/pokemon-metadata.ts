import {
  type PokemonColorSwatch,
  type PokemonMetadataOverrideEntry,
  type PokemonPreferenceSource,
} from "../data/schemas.js";

export type PokemonMetadataOverrideFields = {
  preferenceTerms: string[];
  preferenceSource: PokemonPreferenceSource | null;
  overrideSource: string | null;
  overridePrimaryColor: string | null;
  overridePalette: PokemonColorSwatch[];
  overridePattern: string[] | null;
};

export function resolvePokemonMetadataOverrideFields(
  slug: string,
  override: PokemonMetadataOverrideEntry | undefined,
  overridePath: string,
  fallbackColor: string,
): PokemonMetadataOverrideFields {
  const preferenceTerms = normalizePreferenceTerms(override?.preferenceTerms ?? []);
  const hasColorOverride = Boolean(override?.primaryColor || override?.palette);
  const hasMetadataOverride = Boolean(hasColorOverride || override?.pattern || preferenceTerms.length);
  const overridePalette = hasColorOverride ? buildPokemonOverridePalette(override ?? {}, fallbackColor) : [];

  return {
    preferenceTerms,
    preferenceSource: preferenceTerms.length > 0 ? "override" : null,
    overrideSource: hasMetadataOverride ? `${overridePath}#pokemon.${slug}` : null,
    overridePrimaryColor: override?.primaryColor ? normalizeHex(override.primaryColor) : null,
    overridePalette,
    overridePattern: override?.pattern ?? null,
  };
}

export function buildPokemonOverridePalette(
  override: PokemonMetadataOverrideEntry,
  fallbackColor: string,
): PokemonColorSwatch[] {
  const colors = (override.palette?.length ? override.palette : [override.primaryColor ?? fallbackColor]).map(normalizeHex);
  let assigned = 0;
  return colors.map((hex, index) => {
    const percent = index === colors.length - 1 ? Math.round((100 - assigned) * 10) / 10 : Math.round((100 / colors.length) * 10) / 10;
    assigned += percent;
    return { hex, percent };
  });
}

function normalizePreferenceTerms(values: string[]): string[] {
  return Array.from(new Set(values.map(toPreferenceTerm).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

function toPreferenceTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHex(value: string): string {
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}
