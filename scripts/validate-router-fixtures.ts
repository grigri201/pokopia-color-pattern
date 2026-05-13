import {
  DEFAULT_POKEMON_SLUG,
  isPokemonCanonicalPathname,
  normalizePokemonSlug,
  parsePokemonSlugFromLocation,
  parsePokemonSlugFromPathname,
} from "../src/app/router.js";

assertRoute({ pathname: "/pokemon/abra/", hash: "#ditto" }, "abra", "pathname", "path slug must outrank hash slug");
assertRoute({ pathname: "/pokemon/Abra/", hash: "" }, DEFAULT_POKEMON_SLUG, "default", "non-canonical path slug must fall back to default");
assertRoute({ pathname: "/", hash: "#mr-mime" }, "mr-mime", "hash", "hash slug must preserve legacy route");
assertRoute({ pathname: "/", hash: "" }, DEFAULT_POKEMON_SLUG, "default", "empty route must use default Pokemon");
assertRoute({ pathname: "/pokemon/", hash: "" }, DEFAULT_POKEMON_SLUG, "default", "invalid path route must use default Pokemon");
assertRoute({ pathname: "/pokemon/missing-mon/", hash: "" }, "missing-mon", "pathname", "unknown but syntactically valid path slug must be surfaced");
assertRoute(
  { pathname: "/pokemon/missing-mon/", hash: "#ditto" },
  "missing-mon",
  "pathname",
  "unknown but syntactically valid path slug must not be hidden by hash",
);

const encodedPathSlug = parsePokemonSlugFromPathname("/pokemon/Mr%20Mime/");
if (encodedPathSlug !== null) {
  throw new Error(`encoded pathname branch failed: expected null for non-canonical path, got ${encodedPathSlug}`);
}

const malformedSlug = parsePokemonSlugFromPathname("/pokemon/%E0%A4%A/");
if (malformedSlug !== null) {
  throw new Error(`malformed percent-encoding branch failed: expected null, got ${malformedSlug}`);
}

[
  "/pokemon/%2Fditto/",
  "/pokemon/%00ditto/",
  "/pokemon/%2E%2E%2Fditto/",
].forEach((pathname) => {
  const slug = parsePokemonSlugFromPathname(pathname);
  if (slug !== null) {
    throw new Error(`encoded separator pathname branch failed for ${pathname}: expected null, got ${slug}`);
  }
});

const encodedHashRoute = parsePokemonSlugFromLocation({ pathname: "/", hash: "#Mr%20Mime" });
if (encodedHashRoute.slug !== "mr-mime" || encodedHashRoute.source !== "hash") {
  throw new Error(`encoded hash compatibility branch failed: ${JSON.stringify(encodedHashRoute)}`);
}

if (normalizePokemonSlug(" Tatsugiri (Curly Form) ") !== "tatsugiri-curly-form") {
  throw new Error("shared slug normalization branch failed for punctuation and whitespace");
}

if (!isPokemonCanonicalPathname("/pokemon/missing-mon/") || !isPokemonCanonicalPathname("/pokemon/abra")) {
  throw new Error("canonical pathname detection branch failed for Pokemon paths");
}

if (isPokemonCanonicalPathname("/pokemon/") || isPokemonCanonicalPathname("/")) {
  throw new Error("canonical pathname detection branch failed for invalid paths");
}

console.log("Validated Pokemon canonical pathname, legacy hash, default, and unknown route fixtures.");

function assertRoute(
  location: { pathname: string; hash: string },
  expectedSlug: string,
  expectedSource: "pathname" | "hash" | "default",
  branch: string,
): void {
  const route = parsePokemonSlugFromLocation(location);
  if (route.slug !== expectedSlug || route.source !== expectedSource) {
    throw new Error(`${branch}: expected ${expectedSource}:${expectedSlug}, got ${route.source}:${route.slug}`);
  }
}
