export const DEFAULT_POKEMON_SLUG = "ditto" as const;

export type PokemonRouteSource = "pathname" | "hash" | "default";

export type PokemonRoute = {
  slug: string;
  source: PokemonRouteSource;
  requestedSlug: string | null;
};

export type PokemonLocationLike = {
  pathname: string;
  hash: string;
};

export function parsePokemonSlugFromLocation(
  location: PokemonLocationLike,
  defaultSlug = DEFAULT_POKEMON_SLUG,
): PokemonRoute {
  const pathSlug = parsePokemonSlugFromPathname(location.pathname);
  if (pathSlug) {
    return { slug: pathSlug, source: "pathname", requestedSlug: pathSlug };
  }

  const hashSlug = parsePokemonSlugFromHash(location.hash);
  if (hashSlug) {
    return { slug: hashSlug, source: "hash", requestedSlug: hashSlug };
  }

  return {
    slug: normalizePokemonSlug(defaultSlug) || DEFAULT_POKEMON_SLUG,
    source: "default",
    requestedSlug: null,
  };
}

export function parsePokemonSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/pokemon\/([^/?#]+)\/?$/);
  if (!match) {
    return null;
  }
  const decoded = decodeUrlComponent(match[1]);
  return isCanonicalPokemonSlug(decoded) ? decoded : null;
}

export function isPokemonCanonicalPathname(pathname: string): boolean {
  return /^\/pokemon\/[^/?#]+\/?$/.test(pathname);
}

export function parsePokemonSlugFromHash(hash: string): string | null {
  return normalizePokemonSlug(decodeUrlComponent(hash.replace(/^#/, ""))) || null;
}

export function normalizePokemonSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isCanonicalPokemonSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
