import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCsv } from "./lib/csv.js";
import { writeJsonFile } from "./lib/write-json.js";

type FavoriteLink = {
  slug: string;
  label: string;
};

type DexDetail = {
  sourceSlug: string;
  sourcePage: string;
  favorites: FavoriteLink[];
  lovedItems: Array<{
    slug: string;
    name: string;
    terms: string[];
  }>;
};

type OutputPokemonEntry = {
  slug: string;
  name: string;
  sourceSlug: string;
  sourcePage: string;
  sourceKind: "direct" | "species_alias";
  favorites: FavoriteLink[];
  preferenceTerms: string[];
};

type OutputData = {
  schemaVersion: "pokopiadex-pokemon-preferences.v1";
  generatedFrom: {
    pokemonManifestPath: string;
    pokedexPage: string;
    detailPagePattern: string;
  };
  pokemon: OutputPokemonEntry[];
  itemPreferenceTerms: Array<{
    slug: string;
    terms: string[];
  }>;
};

const projectRoot = process.cwd();
const pokemonManifestPath = "docs/pokopia_image_sources/pokemon_portraits/manifest.csv";
const outputPath = "docs/pokopia_image_sources/pokopiadex_pokemon_preferences.json";
const pokedexPage = "https://pokopiadex.com/pokedex";
const siteOrigin = "https://pokopiadex.com";
const localSourceAliases: Record<string, string> = {
  "chef-dente": "greedent",
  "dj-rotom": "rotom",
  mosslax: "snorlax-mossy",
  peakychu: "pikachu-pale",
  "prof-tangrowth": "tangrowth-professor",
  smearguru: "smeargle",
};

const output = await buildPreferenceSource();
await writeJsonFile(resolve(projectRoot, outputPath), output);

console.log(
  `Wrote ${outputPath} with ${output.pokemon.length} Pokemon preference rows and ${output.itemPreferenceTerms.length} item keyword rows.`,
);

async function buildPreferenceSource(): Promise<OutputData> {
  const [manifestText, pokedexHtml] = await Promise.all([
    readFile(resolve(projectRoot, pokemonManifestPath), "utf8"),
    fetchText(pokedexPage),
  ]);
  const manifest = parseCsv(manifestText);
  const detailUrls = extractPokedexDetailUrls(pokedexHtml);
  const detailRows = await mapWithConcurrency(detailUrls, 8, async (detailUrl) => parseDexDetail(detailUrl, await fetchText(detailUrl)));
  const detailsBySourceSlug = new Map(detailRows.map((row) => [row.sourceSlug, row]));
  const itemTerms = new Map<string, Set<string>>();

  detailRows.forEach((detail) => {
    detail.lovedItems.forEach((item) => {
      const terms = itemTerms.get(item.slug) ?? new Set<string>();
      item.terms.forEach((term) => terms.add(term));
      itemTerms.set(item.slug, terms);
    });
  });

  const pokemon = manifest.rows
    .filter((row) => row.values.status === "ok" && row.values.kind === "pokemon")
    .map((row): OutputPokemonEntry => {
      const slug = pokemonSlug(row.values);
      const sourceSlug = localSourceAliases[slug] ?? slug;
      const detail = detailsBySourceSlug.get(sourceSlug);
      if (!detail) {
        throw new Error(`No PokopiaDex preference page found for ${slug} via ${sourceSlug}`);
      }

      return {
        slug,
        name: row.values.name,
        sourceSlug,
        sourcePage: detail.sourcePage,
        sourceKind: sourceSlug === slug ? "direct" : "species_alias",
        favorites: detail.favorites,
        preferenceTerms: normalizeTerms(detail.favorites.map((favorite) => favorite.label)),
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug, "en"));

  return {
    schemaVersion: "pokopiadex-pokemon-preferences.v1",
    generatedFrom: {
      pokemonManifestPath,
      pokedexPage,
      detailPagePattern: `${siteOrigin}/pokedex/{slug}`,
    },
    pokemon,
    itemPreferenceTerms: Array.from(itemTerms.entries())
      .map(([slug, terms]) => ({
        slug,
        terms: normalizeTerms(Array.from(terms)),
      }))
      .filter((entry) => entry.terms.length > 0)
      .sort((left, right) => left.slug.localeCompare(right.slug, "en")),
  };
}

async function parseDexDetail(detailUrl: string, html: string): Promise<DexDetail> {
  const urlSlug = detailUrl.split("/").pop() ?? "";
  const sourceSlug = urlSlug.replace(/-\d+$/, "");

  return {
    sourceSlug,
    sourcePage: detailUrl,
    favorites: extractFavoriteLinks(html),
    lovedItems: extractLovedItems(html),
  };
}

function extractPokedexDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/href="(\/pokedex\/(?!favorites\/)[^"?#]+)"/g)) {
    const path = match[1];
    if (/-\d+$/.test(path)) {
      urls.add(`${siteOrigin}${path}`);
    }
  }
  return Array.from(urls).sort((left, right) => left.localeCompare(right, "en"));
}

function extractFavoriteLinks(html: string): FavoriteLink[] {
  const section = html.match(/<div class="detail-label"[^>]*>Favorites<\/div><div class="detail-tag-row">([\s\S]*?)<\/div>/);
  if (!section) {
    return [];
  }

  return uniqueBy(
    Array.from(section[1].matchAll(/href="\/pokedex\/favorites\/([^"]+)"[^>]*>([^<]+)<\/a>/g)).map((match) => ({
      slug: decodeHtml(match[1]),
      label: decodeHtml(stripTags(match[2])),
    })),
    (favorite) => favorite.slug,
  ).sort((left, right) => left.slug.localeCompare(right.slug, "en"));
}

function extractLovedItems(html: string): DexDetail["lovedItems"] {
  const items: DexDetail["lovedItems"] = [];
  const cardStartPattern = /<div class="entity-card"[\s\S]*?(?=<div class="entity-card"|<h2|## Explore the Database|$)/g;

  for (const cardMatch of html.matchAll(cardStartPattern)) {
    const cardHtml = cardMatch[0];
    const link = cardHtml.match(/href="\/items\/([^"]+)"/);
    if (!link) {
      continue;
    }
    const name = decodeHtml(stripTags(cardHtml.match(/aria-label="([^"]+)"/)?.[1] ?? ""));
    const terms = normalizeTerms(
      Array.from(cardHtml.matchAll(/white-space:nowrap">([^<]+)<\/span>/g)).map((match) => decodeHtml(stripTags(match[1]))),
    );
    if (terms.length === 0) {
      continue;
    }
    items.push({
      slug: decodeHtml(link[1]),
      name,
      terms,
    });
  }

  return uniqueBy(items, (item) => `${item.slug}:${item.terms.join("|")}`).sort((left, right) =>
    left.slug.localeCompare(right.slug, "en"),
  );
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function mapWithConcurrency<T, U>(items: T[], concurrency: number, work: (item: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await work(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

function pokemonSlug(row: Record<string, string>): string {
  const filenameSlug = row.filename.trim().replace(/\.[^.]+$/, "").replace(/^\d+-/, "");
  return row.slug?.trim() || filenameSlug || slugify(row.name);
}

function normalizeTerms(values: string[]): string[] {
  return Array.from(new Set(values.map(toPreferenceTerm).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

function toPreferenceTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}
