import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  RECOMMENDATIONS_SCHEMA_VERSION,
  validateCompactItemsData,
  validatePokemonIndexData,
  validateRecommendationsData,
  type CompactItem,
  type CompactItemsData,
  type PokemonIndexData,
  type PokemonIndexEntry,
  type RecommendationEntry,
  type RecommendationsData,
} from "../src/data/schemas.js";

const projectRoot = process.cwd();
const distIndexPath = resolve(projectRoot, "dist/index.html");
const compactItemsPath = resolve(projectRoot, "generated/data/compact-items.json");
const pokemonIndexPath = resolve(projectRoot, "generated/data/pokemon-index.json");
const recommendationsDir = resolve(projectRoot, "generated/data/recommendations");
const ssgReportPath = resolve(projectRoot, "generated/reports/ssg-generation-summary.json");
const expectedPokemonCount = 311;
const siteOrigin = normalizeSiteOrigin(process.env.POKOPIA_SITE_URL ?? "https://pokopia-color-pattern.local");

const template = await readFile(distIndexPath, "utf8");
const compactItems = await readJson<CompactItemsData>(compactItemsPath);
const pokemonIndex = await readJson<PokemonIndexData>(pokemonIndexPath);
assertNoSchemaIssues("generated/data/compact-items.json", validateCompactItemsData(compactItems));
assertNoSchemaIssues("generated/data/pokemon-index.json", validatePokemonIndexData(pokemonIndex));
const itemBySlug = new Map(compactItems.items.map((item) => [item.slug, item]));

if (pokemonIndex.pokemon.length !== expectedPokemonCount) {
  throw new Error(`Expected ${expectedPokemonCount} Pokemon static pages, got ${pokemonIndex.pokemon.length}`);
}

const generationResults = await Promise.all(
  pokemonIndex.pokemon.map(async (pokemon) => {
    const recommendationResult = await readRecommendations(pokemon.slug);
    const html = renderPokemonStaticPage(template, pokemon, recommendationResult);
    const outputPath = resolve(projectRoot, "dist", "pokemon", pokemon.slug, "index.html");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
    return {
      pokemonSlug: pokemon.slug,
      outputPath: `dist/pokemon/${pokemon.slug}/index.html`,
      recommendationCount: recommendationResult.data.recommendations.length,
      fallback: recommendationResult.fallback,
    };
  }),
);

await writeSsgReport(generationResults);
console.log(`Generated ${pokemonIndex.pokemon.length} static Pokemon pages under dist/pokemon/{slug}/index.html.`);

type RecommendationFallback = {
  pokemonSlug: string;
  fallbackType: "empty_recommendations" | "missing_recommendation_file";
  reason: string;
  recommendationCount: number;
};

type RecommendationReadResult = {
  data: RecommendationsData;
  fallback: RecommendationFallback | null;
};

type SsgGenerationResult = {
  pokemonSlug: string;
  outputPath: string;
  recommendationCount: number;
  fallback: RecommendationFallback | null;
};

async function readRecommendations(slug: string): Promise<RecommendationReadResult> {
  const filePath = resolve(recommendationsDir, `${slug}.json`);
  let data: RecommendationsData;
  try {
    data = await readJson<RecommendationsData>(filePath);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
    return {
      data: emptyRecommendations(slug),
      fallback: {
        pokemonSlug: slug,
        fallbackType: "missing_recommendation_file",
        reason: `generated/data/recommendations/${slug}.json was not available during SSG`,
        recommendationCount: 0,
      },
    };
  }
  assertNoSchemaIssues(`generated/data/recommendations/${slug}.json`, validateRecommendationsData(data));
  if (data.pokemonSlug !== slug) {
    throw new Error(`Recommendation slug mismatch for ${slug}: got ${data.pokemonSlug}`);
  }
  return {
    data,
    fallback:
      data.recommendations.length === 0
        ? {
            pokemonSlug: slug,
            fallbackType: "empty_recommendations",
            reason: "Recommendation data contains zero entries",
            recommendationCount: 0,
          }
        : null,
  };
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
  recommendationResult: RecommendationReadResult,
): string {
  const primaryColor = pokemon.primaryColor;
  assertRootAbsolutePath(pokemon.imagePath, `pokemon image for ${pokemon.slug}`);
  const fieldInk = readableInk(primaryColor);
  const staticMuted = readableMuted(primaryColor);
  const recommendationSummary = buildRecommendationSummaryText(pokemon, recommendationResult);
  const pageTitle = `${displayPokemonName(pokemon)} | Pokopia Color Pattern`;
  const staticBody = renderStaticBody(pokemon, recommendationResult, recommendationSummary);
  const html = indexHtml
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(pageTitle)}</title>\n    ${renderHeadMetadata(pageTitle, recommendationSummary.text, pokemon)}`)
    .replace(
      '<div id="loading" class="loading">Pokopia Color Pattern</div>',
      `<div id="loading" class="loading is-hidden">Pokopia Color Pattern</div><div id="staticPage" class="static-page-shell" style="--field:${escapeAttribute(primaryColor)}; --field-ink:${escapeAttribute(fieldInk)}; --accent:${escapeAttribute(primaryColor)}; --static-muted:${escapeAttribute(staticMuted)};">${staticBody}</div>`,
    );
  if (!html.includes('id="staticPage"') || html.includes('<div id="loading" class="loading">Pokopia Color Pattern</div>')) {
    throw new Error(`Unable to inject static page content for ${pokemon.slug}; dist/index.html template changed`);
  }
  return html;
}

type RecommendationSummaryText = {
  status: "ready" | "empty" | "missing";
  text: string;
};

function renderHeadMetadata(pageTitle: string, pageDescription: string, pokemon: PokemonIndexEntry): string {
  const canonicalUrl = staticPageUrl(pokemon.slug);
  const imageUrl = staticAssetUrl(pokemon.imagePath);
  return [
    `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeAttribute(pageDescription)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttribute(pageTitle)}" />`,
    `<meta property="og:description" content="${escapeAttribute(pageDescription)}" />`,
    `<meta property="og:image" content="${escapeAttribute(imageUrl)}" />`,
    `<meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeAttribute(pageTitle)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(pageDescription)}" />`,
    `<meta name="twitter:image" content="${escapeAttribute(imageUrl)}" />`,
  ].join("\n    ");
}

function renderStaticBody(
  pokemon: PokemonIndexEntry,
  recommendationResult: RecommendationReadResult,
  recommendationSummary: RecommendationSummaryText,
): string {
  assertRootAbsolutePath(pokemon.imagePath, `pokemon image for ${pokemon.slug}`);
  const palette = pokemon.palette.length ? pokemon.palette : [{ hex: pokemon.primaryColor, percent: 100 }];
  const recommendationHtml = renderRecommendationSummary(recommendationResult.data.recommendations.slice(0, 3), recommendationSummary);
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
          <p class="static-summary" data-recommendation-summary="${escapeAttribute(recommendationSummary.text)}" data-recommendation-status="${escapeAttribute(recommendationSummary.status)}" data-recommendation-count="${recommendationResult.data.recommendations.length}">${escapeHtml(recommendationSummary.text)}</p>
          ${recommendationHtml}
        </section>
      </article>
  `;
}

function renderRecommendationSummary(entries: RecommendationEntry[], summary: RecommendationSummaryText): string {
  if (entries.length === 0) {
    return `<p class="static-empty">${escapeHtml(recoveryText(summary.status))}</p>`;
  }

  entries.forEach((entry) => assertRootAbsolutePath(requireRecommendationItem(entry).imagePath, `recommendation image for ${entry.itemSlug}`));
  return `
          <ol class="static-recommendations">
            ${entries
              .map((entry) => {
                const item = requireRecommendationItem(entry);
                return `
                  <li>
                    <img src="${escapeAttribute(item.imagePath)}" alt="${escapeAttribute(displayItemName(item))}" />
                    <span>
                      <strong>${escapeHtml(displayItemName(item))}</strong>
                      <small>${escapeHtml(recommendationSummaryLine(entry, item))}</small>
                    </span>
                  </li>
                `;
              })
              .join("")}
          </ol>
  `;
}

function recommendationSummaryLine(entry: RecommendationEntry, item: CompactItem): string {
  const color = item.recommendation.itemPrimaryColor ?? "no color";
  const base = `${item.category || "Other"} · ${color} · ${entry.harmonyStatus}`;
  if (item.recommendation.isDyeable !== true || entry.recommendedDyeColors.length === 0) {
    return base;
  }
  return `${base} · dye ${entry.recommendedDyeColors.join(", ")}`;
}

function buildRecommendationSummaryText(
  pokemon: PokemonIndexEntry,
  recommendationResult: RecommendationReadResult,
): RecommendationSummaryText {
  const displayName = displayPokemonName(pokemon);
  const slugLabel = `#${pokemon.slug}`;
  const entries = recommendationResult.data.recommendations.slice(0, 3);
  if (entries.length > 0) {
    const names = entries.map((entry) => displayItemName(requireRecommendationItem(entry))).join("、");
    return {
      status: "ready",
      text: `${displayName}（${slugLabel}）主色 ${pokemon.primaryColor}，推荐搭配：${names}。`,
    };
  }
  if (recommendationResult.fallback?.fallbackType === "missing_recommendation_file") {
    return {
      status: "missing",
      text: `${displayName}（${slugLabel}）主色 ${pokemon.primaryColor}；当前缺少推荐数据文件，静态页先展示色板与可恢复空推荐摘要。`,
    };
  }
  return {
    status: "empty",
    text: `${displayName}（${slugLabel}）主色 ${pokemon.primaryColor}；当前数据和规则暂未产生推荐搭配，可先查看色板。`,
  };
}

function requireRecommendationItem(entry: RecommendationEntry): CompactItem {
  const item = itemBySlug.get(entry.itemSlug);
  if (!item) {
    throw new Error(`Recommendation item ${entry.itemSlug} is missing from generated/data/compact-items.json`);
  }
  return item;
}

function displayItemName(item: CompactItem): string {
  return item.nameZh || item.name;
}

async function writeSsgReport(results: SsgGenerationResult[]): Promise<void> {
  const fallbacks = results
    .flatMap((result) => (result.fallback ? [result.fallback] : []))
    .sort((left, right) => left.pokemonSlug.localeCompare(right.pokemonSlug, "en"));
  const report = {
    schemaVersion: "ssg-generation-summary.v1",
    summary: {
      pokemonCount: pokemonIndex.pokemon.length,
      pagesGenerated: results.length,
      metadataCount: results.length,
      siteUrl: siteOrigin,
      fallbackCount: fallbacks.length,
      emptyRecommendationCount: fallbacks.filter((fallback) => fallback.fallbackType === "empty_recommendations").length,
      missingRecommendationFileCount: fallbacks.filter((fallback) => fallback.fallbackType === "missing_recommendation_file").length,
    },
    pages: results
      .map((result) => ({
        pokemonSlug: result.pokemonSlug,
        outputPath: result.outputPath,
        recommendationCount: result.recommendationCount,
        fallbackType: result.fallback?.fallbackType ?? null,
      }))
      .sort((left, right) => left.pokemonSlug.localeCompare(right.pokemonSlug, "en")),
    fallbacks,
  };
  await mkdir(dirname(ssgReportPath), { recursive: true });
  await writeFile(ssgReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function emptyRecommendations(slug: string): RecommendationsData {
  return {
    schemaVersion: RECOMMENDATIONS_SCHEMA_VERSION,
    pokemonSlug: slug,
    pageSize: 10,
    totalPages: 0,
    recommendations: [],
  };
}

function recoveryText(status: RecommendationSummaryText["status"]): string {
  if (status === "missing") {
    return "推荐数据文件缺失；重新生成数据后此页会自动展示搭配候选。";
  }
  if (status === "empty") {
    return "推荐数据为空；补充偏好词或 override 后此页会自动展示搭配候选。";
  }
  return "推荐摘要来自当前 Pokemon 的 generated recommendation data。";
}

function displayPokemonName(pokemon: PokemonIndexEntry): string {
  return pokemon.zhName ? `${pokemon.zhName} / ${pokemon.name}` : pokemon.name;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function staticPageUrl(slug: string): string {
  return `${siteOrigin}/pokemon/${slug}/`;
}

function staticAssetUrl(path: string): string {
  return `${siteOrigin}${path}`;
}

function normalizeSiteOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`POKOPIA_SITE_URL must use http or https, got ${value}`);
  }
  return url.origin;
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
