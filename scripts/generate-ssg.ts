import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  validatePokemonIndexData,
  validateRecommendationsData,
  type PokemonIndexData,
  type PokemonIndexEntry,
  type RecommendationEntry,
  type RecommendationsData,
} from "../src/data/schemas.js";

const projectRoot = process.cwd();
const distIndexPath = resolve(projectRoot, "dist/index.html");
const pokemonIndexPath = resolve(projectRoot, "generated/data/pokemon-index.json");
const recommendationsDir = resolve(projectRoot, "generated/data/recommendations");
const expectedPokemonCount = 311;

const template = await readFile(distIndexPath, "utf8");
const pokemonIndex = await readJson<PokemonIndexData>(pokemonIndexPath);
assertNoSchemaIssues("generated/data/pokemon-index.json", validatePokemonIndexData(pokemonIndex));

if (pokemonIndex.pokemon.length !== expectedPokemonCount) {
  throw new Error(`Expected ${expectedPokemonCount} Pokemon static pages, got ${pokemonIndex.pokemon.length}`);
}

await Promise.all(
  pokemonIndex.pokemon.map(async (pokemon) => {
    const recommendations = await readRecommendations(pokemon.slug);
    const html = renderPokemonStaticPage(template, pokemon, recommendations);
    const outputPath = resolve(projectRoot, "dist", "pokemon", pokemon.slug, "index.html");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
  }),
);

console.log(`Generated ${pokemonIndex.pokemon.length} static Pokemon pages under dist/pokemon/{slug}/index.html.`);

async function readRecommendations(slug: string): Promise<RecommendationsData> {
  const data = await readJson<RecommendationsData>(resolve(recommendationsDir, `${slug}.json`));
  assertNoSchemaIssues(`generated/data/recommendations/${slug}.json`, validateRecommendationsData(data));
  if (data.pokemonSlug !== slug) {
    throw new Error(`Recommendation slug mismatch for ${slug}: got ${data.pokemonSlug}`);
  }
  return data;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function assertNoSchemaIssues(file: string, issues: Array<{ path: string; message: string }>): void {
  if (issues.length > 0) {
    throw new Error(`${file} schema validation failed: ${issues.slice(0, 3).map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
  }
}

function renderPokemonStaticPage(
  indexHtml: string,
  pokemon: PokemonIndexEntry,
  recommendations: RecommendationsData,
): string {
  const primaryColor = pokemon.primaryColor;
  const fieldInk = readableInk(primaryColor);
  const staticMuted = readableMuted(primaryColor);
  const pageTitle = `${displayPokemonName(pokemon)} | Pokopia Color Pattern`;
  const staticBody = renderStaticBody(pokemon, recommendations);
  const html = indexHtml
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(pageTitle)}</title>`)
    .replace(
      '<div id="loading" class="loading">Pokopia Color Pattern</div>',
      `<div id="loading" class="loading is-hidden">Pokopia Color Pattern</div><div id="staticPage" class="static-page-shell" style="--field:${escapeAttribute(primaryColor)}; --field-ink:${escapeAttribute(fieldInk)}; --accent:${escapeAttribute(primaryColor)}; --static-muted:${escapeAttribute(staticMuted)};">${staticBody}</div>`,
    );
  if (!html.includes('id="staticPage"') || html.includes('<div id="loading" class="loading">Pokopia Color Pattern</div>')) {
    throw new Error(`Unable to inject static page content for ${pokemon.slug}; dist/index.html template changed`);
  }
  return html;
}

function renderStaticBody(pokemon: PokemonIndexEntry, recommendations: RecommendationsData): string {
  assertRootAbsolutePath(pokemon.imagePath, `pokemon image for ${pokemon.slug}`);
  const palette = pokemon.palette.length ? pokemon.palette : [{ hex: pokemon.primaryColor, percent: 100 }];
  const recommendationSummary = renderRecommendationSummary(recommendations.recommendations.slice(0, 3));
  return `
      <article class="static-page" data-static-pokemon="${escapeAttribute(pokemon.slug)}">
        <header class="static-hero">
          <p class="kicker">Pokopia / Static Pokemon Page</p>
          <h1>${escapeHtml(pokemon.zhName || pokemon.name)} <em>${escapeHtml(pokemon.name)}</em></h1>
          <p class="static-number">No. ${escapeHtml(pokemon.sequence)} · #${escapeHtml(pokemon.slug)}</p>
          <img class="static-portrait" src="${escapeAttribute(pokemon.imagePath)}" alt="${escapeAttribute(displayPokemonName(pokemon))}" />
        </header>

        <section class="static-section" aria-label="Pokemon color values">
          <h2>主色与色板</h2>
          <dl class="static-color-grid">
            <div><dt>HEX</dt><dd>${escapeHtml(pokemon.primaryColor)}</dd></div>
            <div><dt>Color Source</dt><dd>${escapeHtml(pokemon.colorSource)}</dd></div>
            <div><dt>Pattern Cells</dt><dd>${pokemon.pattern.length}</dd></div>
          </dl>
          <ul class="static-swatches">
            ${palette.map((color) => `<li><span style="background:${escapeAttribute(color.hex)}"></span>${escapeHtml(color.hex)} · ${Math.round(color.percent)}%</li>`).join("")}
          </ul>
        </section>

        <section class="static-section" aria-label="Recommendation summary">
          <h2>推荐摘要</h2>
          ${recommendationSummary}
        </section>
      </article>
  `;
}

function renderRecommendationSummary(entries: RecommendationEntry[]): string {
  if (entries.length === 0) {
    return `<p class="static-empty">当前数据和规则暂未产生推荐搭配。</p>`;
  }

  entries.forEach((entry) => assertRootAbsolutePath(entry.itemImagePath, `recommendation image for ${entry.itemSlug}`));
  return `
          <ol class="static-recommendations">
            ${entries
              .map(
                (entry) => `
                  <li>
                    <img src="${escapeAttribute(entry.itemImagePath)}" alt="${escapeAttribute(entry.itemZhName || entry.itemName)}" />
                    <span>
                      <strong>${escapeHtml(entry.itemZhName || entry.itemName)}</strong>
                      <small>${escapeHtml(entry.category || "Other")} · ${escapeHtml(entry.harmonyStatus)}</small>
                    </span>
                  </li>
                `,
              )
              .join("")}
          </ol>
  `;
}

function displayPokemonName(pokemon: PokemonIndexEntry): string {
  return pokemon.zhName ? `${pokemon.zhName} / ${pokemon.name}` : pokemon.name;
}

function assertRootAbsolutePath(path: string, label: string): void {
  if (!path.startsWith("/")) {
    throw new Error(`Expected root-absolute ${label} path, got ${path}`);
  }
  if (path.startsWith("//")) {
    throw new Error(`Expected local root-absolute ${label} path, got ${path}`);
  }
  if (path.includes("\\") || path.includes("..")) {
    throw new Error(`Expected normalized root-absolute ${label} path, got ${path}`);
  }
}

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function readableInk(hex: string): string {
  return contrastRatio(parseHexColor(hex), parseHexColor("#fff8ea")) >= contrastRatio(parseHexColor(hex), parseHexColor("#1c1a17"))
    ? "#fff8ea"
    : "#1c1a17";
}

function readableMuted(hex: string): string {
  return readableInk(hex) === "#fff8ea" ? "#d8d0c4" : "#6f665d";
}

function parseHexColor(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Expected 6-digit hex color, got ${hex}`);
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function contrastRatio(left: Rgb, right: Rgb): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: Rgb): number {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}
