import "./styles.css";
import { filterPokemon, isPokemonRange, pokemonAltText, type PokemonRange } from "./app/pokemon-ui.js";
import { GeneratedDataError, loadGeneratedData, loadRecommendationData } from "./data/client";
import type { CompactItem, PokemonIndexEntry, RecommendationEntry, RecommendationsData } from "./data/schemas";

const DEFAULT_POKEMON = "ditto";
const ITEM_FILTER_KEYS = ["全部", "家具", "装饰", "玩具", "地块", "食物"] as const;

type ItemFilter = (typeof ITEM_FILTER_KEYS)[number];
type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };
type Cmyk = { c: number; m: number; y: number; k: number };
type PaletteColor = { rgb: Rgb; hex: string; percent: number };
type NormalizedPaletteColor = PaletteColor & { ratio: number };

type Pokemon = {
  sequence: string;
  name: string;
  zh: string;
  slug: string;
  image: string;
  palette: PaletteColor[];
};

type SelectedPokemon = Pokemon;

type PlaceableItem = {
  index: number;
  id: string;
  name: string;
  zh: string;
  slug: string;
  category: string;
  tags: string[];
  event: string;
  image: string;
  source: string;
};

type RecommendationPanelState = {
  status: "idle" | "loading" | "ready" | "error";
  slug: string | null;
  data: RecommendationsData | null;
  error: string | null;
  pageIndex: number;
  requestId: number;
};
type RecommendationRecoveryAction = "retry" | "switch-pokemon" | "reset-filter";

const state: {
  pokemon: Pokemon[];
  items: PlaceableItem[];
  itemBySlug: Map<string, PlaceableItem>;
  selected: SelectedPokemon | null;
  query: string;
  range: PokemonRange;
  itemCategory: ItemFilter;
  recommendations: RecommendationPanelState;
} = {
  pokemon: [],
  items: [],
  itemBySlug: new Map(),
  selected: null,
  query: "",
  range: "all",
  itemCategory: "全部",
  recommendations: {
    status: "idle",
    slug: null,
    data: null,
    error: null,
    pageIndex: 0,
    requestId: 0,
  },
};

function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function isItemFilter(value: string): value is ItemFilter {
  return ITEM_FILTER_KEYS.includes(value as ItemFilter);
}

const els = {
  app: queryElement<HTMLElement>("#app"),
  loading: queryElement<HTMLElement>("#loading"),
  drawer: queryElement<HTMLElement>("#pokemonDrawer"),
  drawerTrigger: queryElement<HTMLButtonElement>("#drawerTrigger"),
  drawerBackdrop: queryElement<HTMLButtonElement>("#drawerBackdrop"),
  drawerClose: queryElement<HTMLButtonElement>("#drawerClose"),
  floatPortrait: queryElement<HTMLImageElement>("#floatPortrait"),
  floatName: queryElement<HTMLElement>("#floatName"),
  floatMeta: queryElement<HTMLElement>("#floatMeta"),
  pokemonList: queryElement<HTMLOListElement>("#pokemonList"),
  searchInput: queryElement<HTMLInputElement>("#searchInput"),
  resultCount: queryElement<HTMLElement>("#resultCount"),
  title: queryElement<HTMLElement>("#pokemonTitle"),
  selectedPortrait: queryElement<HTMLImageElement>("#selectedPortrait"),
  portraitNumber: queryElement<HTMLElement>("#portraitNumber"),
  hashLabel: queryElement<HTMLElement>("#hashLabel"),
  metricStrip: queryElement<HTMLElement>("#metricStrip"),
  swatchList: queryElement<HTMLElement>("#swatchList"),
  paletteTotal: queryElement<HTMLElement>("#paletteTotal"),
  patternTotal: queryElement<HTMLElement>("#patternTotal"),
  patternView: queryElement<HTMLElement>("#patternView"),
  furnitureGrid: queryElement<HTMLElement>("#furnitureGrid"),
  itemFilter: queryElement<HTMLSelectElement>("#itemFilter"),
  itemSectionTitle: queryElement<HTMLElement>("#itemSectionTitle"),
};

async function boot(): Promise<void> {
  const generatedData = await loadGeneratedData();
  state.pokemon = generatedData.pokemonIndex.pokemon.map(toPokemon);
  state.items = generatedData.compactItems.items.map(toPlaceableItem);
  state.itemBySlug = new Map(state.items.map((item) => [item.slug, item]));

  closeDrawer();
  bindEvents();
  renderList();

  const hashSlug = slugify(decodeURIComponent(location.hash.replace(/^#/, "")));
  const initial =
    state.pokemon.find((pokemon) => pokemon.slug === hashSlug) ||
    state.pokemon.find((pokemon) => pokemon.slug === DEFAULT_POKEMON) ||
    state.pokemon[0];

  if (!initial) {
    throw new Error("No Pokemon entries found in generated data");
  }

  els.loading.classList.add("is-hidden");
  els.app.classList.remove("is-hidden");
  els.drawerTrigger.classList.remove("is-hidden");
  selectPokemon(initial.slug, false);
}

function bindEvents(): void {
  els.drawerTrigger.addEventListener("click", openDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  els.drawerClose.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
    renderList();
  });

  els.itemFilter.addEventListener("change", (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (isItemFilter(value)) {
      state.itemCategory = value;
      state.recommendations.pageIndex = 0;
    }
    if (state.selected) {
      renderRecommendations();
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      if (isPokemonRange(button.dataset.range)) {
        state.range = button.dataset.range;
      }
      updateRangeButtons();
      renderList();
    });
  });
  updateRangeButtons();

  window.addEventListener("hashchange", () => {
    const slug = slugify(decodeURIComponent(location.hash.replace(/^#/, "")));
    if (slug && (!state.selected || slug !== state.selected.slug)) {
      selectPokemon(slug, false);
    }
  });
}

function renderList(): void {
  const filtered = filterPokemon(state.pokemon, state.query, state.range);

  els.resultCount.textContent = String(filtered.length).padStart(3, "0");
  els.pokemonList.innerHTML = filtered
    .map(
      (pokemon) => `
        <li>
          <button class="pokemon-item${state.selected?.slug === pokemon.slug ? " is-active" : ""}"
            type="button"
            data-slug="${pokemon.slug}"
            aria-current="${state.selected?.slug === pokemon.slug ? "true" : "false"}"
            aria-label="${escapeHtml(pokemonAltText(pokemon))}">
            <img class="thumb" src="${pokemon.image}" alt="" loading="lazy" />
            <span class="pokemon-name">
              <strong>${escapeHtml(pokemon.zh)}</strong>
              <span>${escapeHtml(pokemon.name)}</span>
            </span>
            <span class="seq">${pokemon.sequence}</span>
          </button>
        </li>
      `,
    )
    .join("");

  els.pokemonList.querySelectorAll<HTMLButtonElement>("[data-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.slug) {
        selectPokemon(button.dataset.slug);
      }
      closeDrawer();
    });
  });
}

function updateRangeButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-range]").forEach((button) => {
    const isActive = button.dataset.range === state.range;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function openDrawer(): void {
  document.body.classList.add("drawer-open");
  els.drawer.inert = false;
  els.drawerBackdrop.tabIndex = 0;
  els.drawer.setAttribute("aria-hidden", "false");
  els.drawerTrigger.setAttribute("aria-expanded", "true");
  window.setTimeout(() => els.searchInput.focus(), 120);
}

function closeDrawer(): void {
  document.body.classList.remove("drawer-open");
  els.drawer.inert = true;
  els.drawerBackdrop.tabIndex = -1;
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawerTrigger.setAttribute("aria-expanded", "false");
}

function selectPokemon(slug: string, updateHash = true): void {
  const pokemon = state.pokemon.find((item) => item.slug === slug) || state.pokemon[0];
  if (!pokemon) {
    return;
  }

  const selected: SelectedPokemon = {
    ...pokemon,
    palette: pokemon.palette.length ? pokemon.palette : [fallbackColor(pokemon.slug)],
  };
  const requestId = state.recommendations.requestId + 1;
  state.selected = selected;
  state.recommendations = {
    status: "loading",
    slug: selected.slug,
    data: null,
    error: null,
    pageIndex: 0,
    requestId,
  };

  if (updateHash) {
    history.replaceState(null, "", `#${pokemon.slug}`);
  }

  renderList();
  renderStage(selected);
  renderInspector(selected);
  renderFloatingPokemon(selected);
  void loadSelectedRecommendations(selected.slug, requestId);
}

async function loadSelectedRecommendations(slug: string, requestId: number): Promise<void> {
  try {
    const data = await loadRecommendationData(slug);
    if (!isActiveRecommendationRequest(slug, requestId)) {
      return;
    }
    state.recommendations = {
      status: "ready",
      slug,
      data,
      error: null,
      pageIndex: 0,
      requestId,
    };
  } catch (error) {
    if (!isActiveRecommendationRequest(slug, requestId)) {
      return;
    }
    state.recommendations = {
      status: "error",
      slug,
      data: null,
      error: errorMessage(error),
      pageIndex: 0,
      requestId,
    };
  }
  renderRecommendations();
}

function isActiveRecommendationRequest(slug: string, requestId: number): boolean {
  return state.selected?.slug === slug && state.recommendations.requestId === requestId;
}

function renderStage(pokemon: SelectedPokemon): void {
  const primary = pokemon.palette[0] || fallbackColor(pokemon.slug);
  const cmyk = rgbToCmyk(primary.rgb);
  const textColor = readableInk(primary.rgb);

  document.documentElement.style.setProperty("--field", primary.hex);
  document.documentElement.style.setProperty("--field-ink", textColor);
  document.documentElement.style.setProperty("--accent", primary.hex);

  els.title.innerHTML = `${escapeHtml(pokemon.zh)} <em>${escapeHtml(pokemon.name)}</em>`;
  els.selectedPortrait.src = pokemon.image;
  els.selectedPortrait.alt = pokemonAltText(pokemon);
  els.portraitNumber.textContent = pokemon.sequence;
  els.hashLabel.textContent = `#${pokemon.slug}`;

  const metricData: Array<[string, string]> = [
    ["HEX", primary.hex.toUpperCase()],
    ["RGB", `${primary.rgb.r}, ${primary.rgb.g}, ${primary.rgb.b}`],
    ["CMYK", `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`],
  ];

  els.metricStrip.innerHTML = metricData
    .map(
      ([label, value]) => `
        <div class="metric">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
}

function renderFloatingPokemon(pokemon: SelectedPokemon): void {
  els.floatPortrait.src = pokemon.image;
  els.floatPortrait.alt = "";
  els.floatName.textContent = `${pokemon.zh} / ${pokemon.name}`;
  els.floatMeta.innerHTML = `
    <span>No. ${pokemon.sequence}</span>
  `;
}

function renderInspector(pokemon: SelectedPokemon): void {
  renderPalette(pokemon.palette);
  renderPattern(pokemon.palette);
  renderRecommendations();
}

function renderPalette(palette: PaletteColor[]): void {
  els.paletteTotal.textContent = `${palette.length} colors`;
  els.swatchList.innerHTML = palette
    .map(
      (color, index) => `
        <div class="swatch-row">
          <span class="swatch" style="background:${color.hex}"></span>
          <span class="swatch-info">
            <strong>${String(index + 1).padStart(2, "0")} / ${color.hex.toUpperCase()}</strong>
            <span>RGB ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}</span>
          </span>
          <span class="percent">${Math.round(color.percent)}%</span>
        </div>
      `,
    )
    .join("");
}

function renderPattern(palette: PaletteColor[]): void {
  const cells = 40;
  const normalized = normalizePalette(palette.length ? palette : [fallbackColor("pattern")]);
  const colors: string[] = [];

  normalized.forEach((item) => {
    const count = Math.max(1, Math.round((item.ratio / 100) * cells));
    for (let index = 0; index < count; index += 1) {
      colors.push(item.hex);
    }
  });

  while (colors.length < cells) {
    colors.push(normalized[colors.length % normalized.length].hex);
  }

  els.patternView.innerHTML = colors
    .slice(0, cells)
    .map((hex) => `<span class="pattern-cell" style="background:${hex}"></span>`)
    .join("");
}

function renderRecommendations(): void {
  els.itemSectionTitle.textContent = `推荐搭配 · ${state.itemCategory}`;

  const selected = state.selected;
  const panel = state.recommendations;
  if (!selected || panel.status === "idle" || panel.status === "loading" || panel.slug !== selected.slug) {
    renderRecommendationState("正在读取推荐搭配", "recommendation-state");
    return;
  }

  if (panel.status === "error") {
    renderRecommendationState(
      `推荐搭配暂时不可用：${panel.error || "未知错误"}。可以重新读取，或切换 Pokemon 继续浏览。`,
      "recommendation-state is-error",
      ["retry", "switch-pokemon"],
    );
    return;
  }

  if (!panel.data) {
    renderRecommendationState("推荐搭配暂时不可用，可以切换 Pokemon 继续浏览。", "recommendation-state is-error", [
      "switch-pokemon",
    ]);
    return;
  }

  const filtered = panel.data.recommendations.filter(recommendationMatchesFilter);
  const totalPages = Math.ceil(filtered.length / panel.data.pageSize);
  const maxPageIndex = Math.max(0, totalPages - 1);
  const pageIndex = clamp(panel.pageIndex, 0, maxPageIndex);
  if (pageIndex !== panel.pageIndex) {
    state.recommendations.pageIndex = pageIndex;
  }

  if (filtered.length === 0) {
    const message =
      panel.data.recommendations.length === 0
        ? "当前数据和规则暂未产生推荐搭配。可以切换 Pokemon，或稍后补充偏好词与 override 后重新生成数据。"
        : "当前筛选下没有推荐搭配。可以显示全部推荐或切换 Pokemon。";
    renderRecommendationState(
      message,
      "recommendation-state",
      panel.data.recommendations.length === 0 ? ["switch-pokemon"] : ["reset-filter", "switch-pokemon"],
    );
    return;
  }

  const start = pageIndex * panel.data.pageSize;
  const pageItems = filtered.slice(start, start + panel.data.pageSize);
  els.furnitureGrid.innerHTML = `
    <div class="recommendation-summary" aria-live="polite">
      <span>${escapeHtml(selected.zh)} 的匹配度较高道具</span>
      <strong>${start + 1}-${start + pageItems.length} / ${filtered.length}</strong>
    </div>
    ${renderSparseRecommendationNotice(panel.data.recommendations.length)}
    <div class="recommendation-list">
      ${pageItems.map(renderRecommendationCard).join("")}
    </div>
    ${renderRecommendationPagination(pageIndex, totalPages)}
  `;
  bindRecommendationRecoveryActions();
  bindRecommendationPagination(totalPages);
}

function renderSparseRecommendationNotice(recommendationCount: number): string {
  if (recommendationCount >= 3) {
    return "";
  }

  return `
    <div class="recommendation-state is-inline" role="status">
      <span>当前规则只产生 ${recommendationCount} 个推荐搭配；结果基于现有数据和规则，可切换 Pokemon 继续比较。</span>
      ${renderRecommendationAction("switch-pokemon")}
    </div>
  `;
}

function renderRecommendationState(
  message: string,
  className: string,
  actions: RecommendationRecoveryAction[] = [],
): void {
  els.furnitureGrid.innerHTML = `
    <div class="${className}" role="status">
      <span>${escapeHtml(message)}</span>
      ${actions.map(renderRecommendationAction).join("")}
    </div>
  `;
  bindRecommendationRecoveryActions();
}

function renderRecommendationAction(action: RecommendationRecoveryAction): string {
  switch (action) {
    case "retry":
      return '<button class="recommendation-retry" type="button" data-recommendation-action="retry">重新读取</button>';
    case "switch-pokemon":
      return '<button class="recommendation-retry" type="button" data-recommendation-action="switch-pokemon">切换 Pokemon</button>';
    case "reset-filter":
      return '<button class="recommendation-retry" type="button" data-recommendation-action="reset-filter">显示全部推荐</button>';
  }
}

function bindRecommendationRecoveryActions(): void {
  els.furnitureGrid.querySelectorAll<HTMLButtonElement>("[data-recommendation-action]").forEach((button) => {
    button.addEventListener("click", () => {
      switch (button.dataset.recommendationAction) {
        case "retry":
          retryRecommendations();
          break;
        case "switch-pokemon":
          openDrawer();
          break;
        case "reset-filter":
          state.itemCategory = "全部";
          state.recommendations.pageIndex = 0;
          els.itemFilter.value = "全部";
          renderRecommendations();
          break;
      }
    });
  });
}

function retryRecommendations(): void {
  if (!state.selected) {
    return;
  }
  const requestId = state.recommendations.requestId + 1;
  state.recommendations = {
    status: "loading",
    slug: state.selected.slug,
    data: null,
    error: null,
    pageIndex: 0,
    requestId,
  };
  renderRecommendations();
  void loadSelectedRecommendations(state.selected.slug, requestId);
}

function renderRecommendationCard(entry: RecommendationEntry): string {
  const item = state.itemBySlug.get(entry.itemSlug);
  const displayName = recommendationDisplayName(entry);
  const category = entry.category || item?.category || "Other";
  const terms = entry.matchedPreferenceTerms.map((term) => `<span>${escapeHtml(term)}</span>`).join("");
  const color = entry.itemPrimaryColor;

  return `
    <article class="recommendation-card">
      <div class="recommendation-visual">
        ${
          entry.itemImagePath
            ? `<img src="${escapeHtml(entry.itemImagePath)}" alt="${escapeHtml(displayName)}" loading="lazy" />`
            : '<span class="recommendation-placeholder" aria-hidden="true"></span>'
        }
      </div>
      <div class="recommendation-copy">
        <div class="recommendation-card-head">
          <h3>${escapeHtml(displayName)}</h3>
          <span>#${String(entry.rank).padStart(2, "0")}</span>
        </div>
        <p>${escapeHtml(recommendationReason(entry))}</p>
        <dl class="recommendation-facts">
          <div>
            <dt>分类</dt>
            <dd>${escapeHtml(category)}</dd>
          </div>
          <div>
            <dt>可染色</dt>
            <dd>${entry.isDyeable ? "是" : "否"}</dd>
          </div>
          <div>
            <dt>主色</dt>
            <dd class="color-value">
              ${color ? `<span class="color-chip" style="background:${escapeHtml(color)}"></span>${escapeHtml(color)}` : "无"}
            </dd>
          </div>
          <div>
            <dt>OKLCH</dt>
            <dd>${escapeHtml(harmonyLabel(entry))}</dd>
          </div>
          <div class="preference-cell">
            <dt>偏好词</dt>
            <dd class="preference-tags">${terms}</dd>
          </div>
          <div>
            <dt>数据页</dt>
            <dd>${entry.pageIndex + 1}</dd>
          </div>
        </dl>
      </div>
    </article>
  `;
}

function renderRecommendationPagination(pageIndex: number, totalPages: number): string {
  const hasPrevious = pageIndex > 0;
  const hasNext = pageIndex < totalPages - 1;
  return `
    <nav class="recommendation-pagination" aria-label="推荐搭配分页">
      <button
        type="button"
        data-recommendation-page="previous"
        aria-label="上一页推荐搭配"
        ${hasPrevious ? "" : "disabled"}>
        上一页
      </button>
      <span>第 ${pageIndex + 1} / ${totalPages} 页</span>
      <button
        type="button"
        data-recommendation-page="next"
        aria-label="下一页推荐搭配"
        ${hasNext ? "" : "disabled"}>
        下一页
      </button>
    </nav>
  `;
}

function bindRecommendationPagination(totalPages: number): void {
  els.furnitureGrid.querySelectorAll<HTMLButtonElement>("[data-recommendation-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.recommendationPage;
      const delta = direction === "previous" ? -1 : 1;
      state.recommendations.pageIndex = clamp(state.recommendations.pageIndex + delta, 0, Math.max(0, totalPages - 1));
      renderRecommendations();
    });
  });
}

function recommendationMatchesFilter(entry: RecommendationEntry): boolean {
  if (state.itemCategory === "全部") {
    return true;
  }

  const item = state.itemBySlug.get(entry.itemSlug);
  const category = entry.category || item?.category || "";
  const tags = item?.tags || [];
  switch (state.itemCategory) {
    case "家具":
      return category === "Furniture";
    case "装饰":
      return tags.includes("Decoration") || category === "Decoration";
    case "玩具":
      return tags.includes("Toy") || category === "Toy";
    case "地块":
      return category === "Blocks" || tags.includes("Road");
    case "食物":
      return category === "Food" || tags.includes("Food");
  }
}

function recommendationDisplayName(entry: RecommendationEntry): string {
  if (!entry.itemZhName || entry.itemZhName === entry.itemName) {
    return entry.itemName;
  }
  return `${entry.itemZhName} / ${entry.itemName}`;
}

function recommendationReason(entry: RecommendationEntry): string {
  const terms = entry.matchedPreferenceTerms.join(", ");
  if (entry.isDyeable) {
    return `命中偏好词：${terms}。可染色道具不需要 OKLCH 过滤。`;
  }
  return `命中偏好词：${terms}。${harmonyLabel(entry)}。`;
}

function harmonyLabel(entry: RecommendationEntry): string {
  if (entry.harmonyStatus === "not_required") {
    return "不需要 OKLCH";
  }
  if (entry.harmonyStatus === "override") {
    return "Override";
  }
  return entry.harmonyType ? `通过 · ${harmonyTypeLabel(entry.harmonyType)}` : "通过";
}

function harmonyTypeLabel(type: RecommendationEntry["harmonyType"]): string {
  switch (type) {
    case "analogous":
      return "Analogous";
    case "complementary":
      return "Complementary";
    case "splitComplementary":
      return "Split Complementary";
    case "triadic":
      return "Triadic";
    case "monochrome":
      return "Monochrome";
    default:
      return "";
  }
}

function slugify(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToCmyk(rgb: Rgb): Cmyk {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function readableInk(rgb: Rgb): string {
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.57 ? "#1c1a17" : "#fff8ea";
}

function normalizePalette(palette: PaletteColor[]): NormalizedPaletteColor[] {
  const total = palette.reduce((sum, color) => sum + color.percent, 0) || 1;
  return palette.map((color) => ({
    ...color,
    ratio: (color.percent / total) * 100,
  }));
}

function seededScore(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 29;
}

function fallbackColor(seed: string): PaletteColor {
  const hue = seededScore(seed) * 12;
  const rgb = hslToRgb({ h: hue, s: 0.42, l: 0.68 });
  return { rgb, hex: rgbToHex(rgb), percent: 100 };
}

function hslToRgb(hsl: Hsl): Rgb {
  const c = (1 - Math.abs(2 * hsl.l - 1)) * hsl.s;
  const x = c * (1 - Math.abs(((hsl.h / 60) % 2) - 1));
  const m = hsl.l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hsl.h < 60) [r, g, b] = [c, x, 0];
  else if (hsl.h < 120) [r, g, b] = [x, c, 0];
  else if (hsl.h < 180) [r, g, b] = [0, c, x];
  else if (hsl.h < 240) [r, g, b] = [0, x, c];
  else if (hsl.h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toPokemon(entry: PokemonIndexEntry): Pokemon {
  const palette = entry.palette.length ? entry.palette : [{ hex: entry.primaryColor, percent: 100 }];

  return {
    sequence: entry.sequence,
    name: entry.name,
    zh: entry.zhName || entry.name,
    slug: entry.slug,
    image: entry.imagePath,
    palette: palette.map((color) => ({
      hex: color.hex,
      rgb: hexToRgb(color.hex),
      percent: color.percent,
    })),
  };
}

function toPlaceableItem(item: CompactItem, index: number): PlaceableItem {
  return {
    index: item.sourceIndex ?? index,
    id: item.id || item.slug,
    name: item.name,
    zh: item.nameZh || item.name,
    slug: item.slug,
    category: item.category || "Other",
    tags: item.tags,
    event: item.event || "",
    image: item.imagePath,
    source: item.sourceDataset || "generated",
  };
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace(/^#/, "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderBootError(error: unknown): void {
  const fileLabel = error instanceof GeneratedDataError ? `（${error.filePath}）` : "";
  const message = error instanceof Error ? error.message : String(error);
  const errorBox = document.createElement("div");
  const title = document.createElement("strong");
  const hint = document.createElement("span");
  const detail = document.createElement("code");
  const retry = document.createElement("button");

  errorBox.className = "loading-error";
  title.textContent = `无法读取 Pokopia 生成数据${fileLabel}`;
  hint.textContent = "请重新运行 npm run generate:data 后刷新页面。";
  detail.className = "error-detail";
  detail.textContent = message;
  retry.type = "button";
  retry.textContent = "重新载入";
  retry.addEventListener("click", () => location.reload());
  errorBox.replaceChildren(title, hint, detail, retry);

  els.app.classList.add("is-hidden");
  els.drawerTrigger.classList.add("is-hidden");
  els.loading.classList.remove("is-hidden");
  els.loading.replaceChildren(errorBox);
}

boot().catch((error) => {
  console.error(error);
  renderBootError(error);
});
