import "./styles.css";
import { filterPokemon, isPokemonRange, pokemonAltText, type PokemonRange } from "./app/pokemon-ui.js";
import {
  DEFAULT_POKEMON_SLUG,
  normalizePokemonSlug,
  parsePokemonSlugFromHash,
  parsePokemonSlugFromLocation,
  type PokemonRouteSource,
} from "./app/router.js";
import { GeneratedDataError, loadGeneratedData, loadRecommendationData } from "./data/client";
import type { CompactItem, PokemonIndexEntry, RecommendationEntry, RecommendationsData } from "./data/schemas";

const ITEM_FILTER_KEYS = ["全部", "家具", "装饰", "玩具", "地块", "食物"] as const;
const LOCALES = ["zh", "en"] as const;
const DEFAULT_LOCALE: Locale = "en";
const LOCALE_STORAGE_KEY = "pokopia-color-pattern.locale";

type ItemFilter = (typeof ITEM_FILTER_KEYS)[number];
type Locale = (typeof LOCALES)[number];
type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };
type Cmyk = { c: number; m: number; y: number; k: number };
type PaletteColor = { rgb: Rgb; hex: string; percent: number };
type NormalizedPaletteColor = PaletteColor & { ratio: number };
type LocalizedLabel = Record<Locale, string>;

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
  locale: Locale;
  itemCategory: ItemFilter;
  recommendations: RecommendationPanelState;
} = {
  pokemon: [],
  items: [],
  itemBySlug: new Map(),
  selected: null,
  query: "",
  range: "all",
  locale: readInitialLocale(),
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

function isLocale(value: string | null): value is Locale {
  return value !== null && LOCALES.includes(value as Locale);
}

function readInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // Storage can be unavailable in private contexts; fall back to the browser locale.
  }
  return readBrowserLocale();
}

function readBrowserLocale(): Locale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const languageTags = [...navigator.languages, navigator.language].filter(Boolean);
  for (const languageTag of languageTags) {
    const locale = localeFromLanguageTag(languageTag);
    if (locale) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

function localeFromLanguageTag(languageTag: string): Locale | null {
  const primarySubtag = languageTag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return isLocale(primarySubtag) ? primarySubtag : null;
}

const ITEM_FILTER_LABELS: Record<Locale, Record<ItemFilter, string>> = {
  zh: {
    全部: "全部",
    家具: "家具",
    装饰: "装饰",
    玩具: "玩具",
    地块: "地块",
    食物: "食物",
  },
  en: {
    全部: "All",
    家具: "Furniture",
    装饰: "Decor",
    玩具: "Toys",
    地块: "Blocks",
    食物: "Food",
  },
};

const TEXT = {
  zh: {
    htmlLang: "zh-Hans",
    currentPokemon: "当前宝可梦",
    closeDrawer: "关闭搜索抽屉",
    languageToggle: "English",
    languageAria: "切换到英文",
    searchPlaceholder: "搜索",
    searchAria: "搜索 Pokemon 名称、英文名或编号",
    rangeLabels: { all: "全部", early: "001-120", late: "121+" },
    listRangeAria: "宝可梦列表范围",
    pokemonListAria: "Pokopia 宝可梦",
    paletteTitle: "色板",
    patternTitle: "图案",
    colorPatternAria: "颜色图案格",
    primaryColorAria: "主色数值",
    paletteCount: (count: number) => `${count} 种颜色`,
    patternCount: (count: number) => `${count} 格`,
    itemMatchTitle: "搭配道具",
    itemFilterAria: "筛选搭配道具类型",
    recommendationTitle: (filter: ItemFilter) => `推荐搭配 · ${ITEM_FILTER_LABELS.zh[filter]}`,
    loadingRecommendations: "正在读取推荐搭配",
    recommendationsUnavailable: "推荐搭配暂时不可用，可以切换 Pokemon 继续浏览。",
    recommendationError: (error: string) => `推荐搭配暂时不可用：${error || "未知错误"}。可以重新读取，或切换 Pokemon 继续浏览。`,
    emptyRecommendations: "当前数据和规则暂未产生推荐搭配。可以切换 Pokemon，或稍后补充 override 后重新生成数据。",
    emptyFilter: "当前筛选下没有推荐搭配。可以显示全部推荐。",
    sparseRecommendations: (count: number) => `当前规则只产生 ${count} 个推荐搭配；结果基于现有数据和规则，可切换 Pokemon 继续比较。`,
    retry: "重新读取",
    switchPokemon: "切换 Pokemon",
    resetFilter: "显示全部推荐",
    paginationAria: "推荐搭配分页",
    previousPageAria: "上一页推荐搭配",
    nextPageAria: "下一页推荐搭配",
    previousPage: "上一页",
    nextPage: "下一页",
    pageLabel: (page: number, total: number) => `第 ${page} / ${total} 页`,
    fieldCategory: "分类",
    fieldDyeable: "可染色",
    fieldDyeColors: "建议染色",
    fieldPrimaryColor: "主色",
    fieldPreferenceTerms: "匹配依据",
    yes: "是",
    no: "否",
    none: "无",
    notFoundPokemon: "找不到 Pokemon",
    route: "ROUTE",
    status: "STATUS",
    notFoundStatus: "NOT FOUND",
    recovery: "RECOVERY",
    searchRecovery: "SEARCH",
    missingSlug: "这个 slug 不在当前 generated data 中。",
    missingRoute: (routeLabel: string) => `未找到 ${routeLabel}。请打开搜索选择其他 Pokemon。`,
    bootErrorTitle: (fileLabel: string) => `无法读取 Pokopia 生成数据${fileLabel}`,
    bootErrorHint: "请重新运行 npm run generate:data 后刷新页面。",
    reload: "重新载入",
  },
  en: {
    htmlLang: "en",
    currentPokemon: "Current Pokemon",
    closeDrawer: "Close search drawer",
    languageToggle: "Chinese",
    languageAria: "Switch to Chinese",
    searchPlaceholder: "Search",
    searchAria: "Search by Pokemon name, English name, or number",
    rangeLabels: { all: "All", early: "001-120", late: "121+" },
    listRangeAria: "Pokemon list range",
    pokemonListAria: "Pokopia Pokemon",
    paletteTitle: "Swatches",
    patternTitle: "Pattern",
    colorPatternAria: "Color pattern cells",
    primaryColorAria: "Primary color values",
    paletteCount: (count: number) => `${count} colors`,
    patternCount: (count: number) => `${count} cells`,
    itemMatchTitle: "Item Match",
    itemFilterAria: "Filter item type",
    recommendationTitle: (filter: ItemFilter) => `Recommendations · ${ITEM_FILTER_LABELS.en[filter]}`,
    loadingRecommendations: "Loading recommendations",
    recommendationsUnavailable: "Recommendations are unavailable. Switch Pokemon to keep browsing.",
    recommendationError: (error: string) => `Recommendations are unavailable: ${error || "unknown error"}. Retry or switch Pokemon to keep browsing.`,
    emptyRecommendations: "No recommendations were generated from the current data and rules. Switch Pokemon or regenerate after adding overrides.",
    emptyFilter: "No recommendations match this filter. Show all recommendations.",
    sparseRecommendations: (count: number) => `Only ${count} recommendations were generated. Results are based on current data and rules.`,
    retry: "Retry",
    switchPokemon: "Switch Pokemon",
    resetFilter: "Show all",
    paginationAria: "Recommendation pagination",
    previousPageAria: "Previous recommendations page",
    nextPageAria: "Next recommendations page",
    previousPage: "Previous",
    nextPage: "Next",
    pageLabel: (page: number, total: number) => `Page ${page} / ${total}`,
    fieldCategory: "Category",
    fieldDyeable: "Dyeable",
    fieldDyeColors: "Suggested dye",
    fieldPrimaryColor: "Primary color",
    fieldPreferenceTerms: "Matched terms",
    yes: "Yes",
    no: "No",
    none: "None",
    notFoundPokemon: "Pokemon not found",
    route: "ROUTE",
    status: "STATUS",
    notFoundStatus: "NOT FOUND",
    recovery: "RECOVERY",
    searchRecovery: "SEARCH",
    missingSlug: "This slug is not in the current generated data.",
    missingRoute: (routeLabel: string) => `${routeLabel} was not found. Open search to choose another Pokemon.`,
    bootErrorTitle: (fileLabel: string) => `Unable to read Pokopia generated data${fileLabel}`,
    bootErrorHint: "Run npm run generate:data again, then refresh.",
    reload: "Reload",
  },
};

const CATEGORY_LABELS: Record<string, LocalizedLabel> = {
  Blocks: { zh: "地块", en: "Blocks" },
  Buildings: { zh: "建筑", en: "Buildings" },
  Decoration: { zh: "装饰", en: "Decoration" },
  Food: { zh: "食物", en: "Food" },
  Furniture: { zh: "家具", en: "Furniture" },
  "Key Items": { zh: "重要道具", en: "Key Items" },
  Kits: { zh: "建造套件", en: "Kits" },
  Materials: { zh: "材料", en: "Materials" },
  "Misc.": { zh: "杂货", en: "Misc." },
  Nature: { zh: "自然", en: "Nature" },
  Other: { zh: "其他", en: "Other" },
  Outdoor: { zh: "户外", en: "Outdoor" },
  Relaxation: { zh: "休闲", en: "Relaxation" },
  Road: { zh: "道路", en: "Road" },
  Toy: { zh: "玩具", en: "Toy" },
  Utilities: { zh: "设施", en: "Utilities" },
};

const TERM_LABELS: Record<string, LocalizedLabel> = {
  dyeable: { zh: "可染色", en: "dyeable" },
  nature: { zh: "自然", en: "nature" },
  "bitter flavors": { zh: "苦味", en: "bitter flavors" },
  "blocky stuff": { zh: "方块感", en: "blocky stuff" },
  "colorful stuff": { zh: "多彩物品", en: "colorful stuff" },
  "complicated stuff": { zh: "复杂物品", en: "complicated stuff" },
  construction: { zh: "建造", en: "construction" },
  containers: { zh: "容器", en: "containers" },
  "cute stuff": { zh: "可爱物品", en: "cute stuff" },
  "dry flavors": { zh: "干燥风味", en: "dry flavors" },
  electronics: { zh: "电子产品", en: "electronics" },
  exercise: { zh: "运动", en: "exercise" },
  fabric: { zh: "布料", en: "fabric" },
  garbage: { zh: "垃圾", en: "garbage" },
  gatherings: { zh: "聚会", en: "gatherings" },
  "glass stuff": { zh: "玻璃物品", en: "glass stuff" },
  "group activities": { zh: "集体活动", en: "group activities" },
  "hard stuff": { zh: "坚硬物品", en: "hard stuff" },
  healing: { zh: "疗愈", en: "healing" },
  "letters and words": { zh: "字母与文字", en: "letters and words" },
  "looks like food": { zh: "像食物", en: "looks like food" },
  "lots of dirt": { zh: "大量泥土", en: "lots of dirt" },
  "lots of fire": { zh: "大量火焰", en: "lots of fire" },
  "lots of nature": { zh: "大量自然", en: "lots of nature" },
  "lots of water": { zh: "大量水", en: "lots of water" },
  luxury: { zh: "奢华", en: "luxury" },
  "metal stuff": { zh: "金属物品", en: "metal stuff" },
  "nice breezes": { zh: "宜人微风", en: "nice breezes" },
  "noisy stuff": { zh: "吵闹物品", en: "noisy stuff" },
  "ocean vibes": { zh: "海洋氛围", en: "ocean vibes" },
  "play spaces": { zh: "游玩空间", en: "play spaces" },
  "pretty flowers": { zh: "漂亮花朵", en: "pretty flowers" },
  rides: { zh: "游乐设施", en: "rides" },
  "round stuff": { zh: "圆形物品", en: "round stuff" },
  "sharp stuff": { zh: "尖锐物品", en: "sharp stuff" },
  "shiny stuff": { zh: "闪亮物品", en: "shiny stuff" },
  "slender objects": { zh: "细长物体", en: "slender objects" },
  "soft stuff": { zh: "柔软物品", en: "soft stuff" },
  "sour flavors": { zh: "酸味", en: "sour flavors" },
  "spicy flavors": { zh: "辣味", en: "spicy flavors" },
  "spinning stuff": { zh: "旋转物品", en: "spinning stuff" },
  "spooky stuff": { zh: "恐怖物品", en: "spooky stuff" },
  "stone stuff": { zh: "石头物品", en: "stone stuff" },
  "strange stuff": { zh: "奇怪物品", en: "strange stuff" },
  "sweet flavors": { zh: "甜味", en: "sweet flavors" },
  symbols: { zh: "符号", en: "symbols" },
  "watching stuff": { zh: "观赏物品", en: "watching stuff" },
  "wobbly stuff": { zh: "摇晃物品", en: "wobbly stuff" },
  "wooden stuff": { zh: "木质物品", en: "wooden stuff" },
};

const DYE_COLOR_LABELS: Record<string, LocalizedLabel> = {
  blue: { zh: "蓝色", en: "blue" },
  orange: { zh: "橙色", en: "orange" },
  pink: { zh: "粉色", en: "pink" },
  purple: { zh: "紫色", en: "purple" },
  red: { zh: "红色", en: "red" },
  white: { zh: "白色", en: "white" },
  yellow: { zh: "黄色", en: "yellow" },
};

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
  languageToggle: queryElement<HTMLButtonElement>("#languageToggle"),
  metricStrip: queryElement<HTMLElement>("#metricStrip"),
  paletteTitle: queryElement<HTMLElement>("#paletteTitle"),
  swatchList: queryElement<HTMLElement>("#swatchList"),
  paletteTotal: queryElement<HTMLElement>("#paletteTotal"),
  patternTitle: queryElement<HTMLElement>("#patternTitle"),
  patternTotal: queryElement<HTMLElement>("#patternTotal"),
  patternView: queryElement<HTMLElement>("#patternView"),
  panelTitle: queryElement<HTMLElement>("#panelTitle"),
  furnitureGrid: queryElement<HTMLElement>("#furnitureGrid"),
  itemFilter: queryElement<HTMLSelectElement>("#itemFilter"),
  itemSectionTitle: queryElement<HTMLElement>("#itemSectionTitle"),
};

function text(): (typeof TEXT)[Locale] {
  return TEXT[state.locale];
}

function nextLocale(locale: Locale): Locale {
  return locale === "zh" ? "en" : "zh";
}

function setLocale(locale: Locale): void {
  state.locale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in private contexts; the in-memory locale is enough.
  }
  renderLocaleChrome();
  renderList();
  if (state.selected) {
    renderStage(state.selected);
    renderFloatingPokemon(state.selected);
    renderInspector(state.selected);
  }
}

function renderLocaleChrome(): void {
  const labels = text();
  document.documentElement.lang = labels.htmlLang;
  document.title = "Pokopia Color Pattern";
  els.drawerBackdrop.setAttribute("aria-label", labels.closeDrawer);
  els.drawerClose.setAttribute("aria-label", labels.closeDrawer);
  els.languageToggle.textContent = labels.languageToggle;
  els.languageToggle.setAttribute("aria-label", labels.languageAria);
  els.searchInput.placeholder = labels.searchPlaceholder;
  els.searchInput.setAttribute("aria-label", labels.searchAria);
  document.querySelector("[aria-label='Pokemon list range'], [aria-label='宝可梦列表范围']")?.setAttribute("aria-label", labels.listRangeAria);
  document.querySelectorAll<HTMLButtonElement>("[data-range]").forEach((button) => {
    if (isPokemonRange(button.dataset.range)) {
      button.textContent = labels.rangeLabels[button.dataset.range];
    }
  });
  els.pokemonList.setAttribute("aria-label", labels.pokemonListAria);
  els.metricStrip.setAttribute("aria-label", labels.primaryColorAria);
  els.paletteTitle.textContent = labels.paletteTitle;
  els.patternTitle.textContent = labels.patternTitle;
  els.patternView.setAttribute("aria-label", labels.colorPatternAria);
  els.panelTitle.textContent = labels.itemMatchTitle;
  els.itemFilter.setAttribute("aria-label", labels.itemFilterAria);
  renderItemFilterOptions();
  els.itemSectionTitle.textContent = labels.recommendationTitle(state.itemCategory);
}

function renderItemFilterOptions(): void {
  const selectedValue = state.itemCategory;
  els.itemFilter.innerHTML = ITEM_FILTER_KEYS.map(
    (key) => `<option value="${escapeHtml(key)}">${escapeHtml(filterLabel(key))}</option>`,
  ).join("");
  els.itemFilter.value = selectedValue;
}

function filterLabel(filter: ItemFilter): string {
  return ITEM_FILTER_LABELS[state.locale][filter];
}

function labelFromMap(map: Record<string, LocalizedLabel>, value: string): string {
  return map[value]?.[state.locale] ?? value;
}

function categoryLabel(value: string): string {
  return labelFromMap(CATEGORY_LABELS, value);
}

function preferenceTermLabel(value: string): string {
  return labelFromMap(TERM_LABELS, value);
}

function dyeColorLabel(value: string): string {
  return labelFromMap(DYE_COLOR_LABELS, value);
}

async function boot(): Promise<void> {
  const generatedData = await loadGeneratedData();
  state.pokemon = generatedData.pokemonIndex.pokemon.map(toPokemon);
  state.items = generatedData.compactItems.items.map(toPlaceableItem);
  state.itemBySlug = new Map(state.items.map((item) => [item.slug, item]));

  closeDrawer();
  bindEvents();
  renderLocaleChrome();
  renderList();

  if (state.pokemon.length === 0) {
    throw new Error("No Pokemon entries found in generated data");
  }

  const route = parsePokemonSlugFromLocation(location, DEFAULT_POKEMON_SLUG);
  document.querySelector("#staticPage")?.remove();
  els.loading.classList.add("is-hidden");
  els.app.classList.remove("is-hidden");
  els.drawerTrigger.classList.remove("is-hidden");
  if (selectPokemon(route.slug, false, route.source) && route.source !== "pathname") {
    updatePokemonUrl(route.slug);
  }
}

function bindEvents(): void {
  els.drawerTrigger.addEventListener("click", openDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  els.drawerClose.addEventListener("click", closeDrawer);
  els.languageToggle.addEventListener("click", () => setLocale(nextLocale(state.locale)));
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
    const slug = parsePokemonSlugFromHash(location.hash);
    if (slug && (!state.selected || slug !== state.selected.slug)) {
      selectPokemon(slug, true, "hash");
    }
  });
}

function renderList(): void {
  const filtered = filterPokemon(state.pokemon, state.query, state.range);

  els.resultCount.textContent = String(filtered.length).padStart(3, "0");
  els.pokemonList.innerHTML = filtered
    .map((pokemon) => {
      const primaryName = pokemonPrimaryDisplayName(pokemon);
      const secondaryName = pokemonSecondaryDisplayName(pokemon);
      return `
        <li>
          <button class="pokemon-item${state.selected?.slug === pokemon.slug ? " is-active" : ""}"
            type="button"
            data-slug="${pokemon.slug}"
            aria-current="${state.selected?.slug === pokemon.slug ? "true" : "false"}"
            aria-label="${escapeHtml(pokemonAltText(pokemon, state.locale))}">
            <img class="thumb" src="${pokemon.image}" alt="" loading="lazy" />
            <span class="pokemon-name">
              <strong>${escapeHtml(primaryName)}</strong>
              <span>${escapeHtml(secondaryName)}</span>
            </span>
            <span class="seq">${pokemon.sequence}</span>
          </button>
        </li>
      `;
    })
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

function selectPokemon(slug: string, updateUrl = true, unknownSource: PokemonRouteSource = "hash"): boolean {
  const normalizedSlug = normalizePokemonSlug(slug);
  const pokemon = state.pokemon.find((item) => item.slug === normalizedSlug);
  if (!pokemon) {
    renderRouteNotFound(normalizedSlug || slug, unknownSource);
    return false;
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

  if (updateUrl) {
    updatePokemonUrl(pokemon.slug);
  }

  renderList();
  renderStage(selected);
  renderInspector(selected);
  renderFloatingPokemon(selected);
  void loadSelectedRecommendations(selected.slug, requestId);
  return true;
}

function updatePokemonUrl(slug: string): void {
  history.replaceState(null, "", `/pokemon/${slug}/`);
}

function renderRouteNotFound(slug: string, source: PokemonRouteSource): void {
  const requestId = state.recommendations.requestId + 1;
  const routeLabel = routeSourceLabel(slug, source);
  const fallback = fallbackColor(`not-found-${slug}`);
  const labels = text();
  state.selected = null;
  state.recommendations = {
    status: "idle",
    slug: null,
    data: null,
    error: null,
    pageIndex: 0,
    requestId,
  };

  document.documentElement.style.setProperty("--field", fallback.hex);
  document.documentElement.style.setProperty("--field-ink", readableInk(fallback.rgb));
  document.documentElement.style.setProperty("--accent", fallback.hex);

  renderList();
  els.title.innerHTML = `${escapeHtml(labels.notFoundPokemon)} <em>${escapeHtml(slug || "unknown")}</em>`;
  els.selectedPortrait.removeAttribute("src");
  els.selectedPortrait.alt = "";
  els.portraitNumber.textContent = "404";
  els.metricStrip.innerHTML = `
    <div class="metric">
      <span>${escapeHtml(labels.route)}</span>
      <strong>${escapeHtml(routeLabel)}</strong>
    </div>
    <div class="metric">
      <span>${escapeHtml(labels.status)}</span>
      <strong>${escapeHtml(labels.notFoundStatus)}</strong>
    </div>
    <div class="metric">
      <span>${escapeHtml(labels.recovery)}</span>
      <strong>${escapeHtml(labels.searchRecovery)}</strong>
    </div>
  `;
  els.paletteTotal.textContent = labels.paletteCount(0);
  els.swatchList.innerHTML = `
    <div class="recommendation-state is-inline">
      <span>${escapeHtml(labels.missingSlug)}</span>
    </div>
  `;
  els.patternTotal.textContent = labels.patternCount(0);
  els.patternView.innerHTML = "";
  els.itemSectionTitle.textContent = labels.recommendationTitle(state.itemCategory);
  renderRecommendationState(labels.missingRoute(routeLabel), "recommendation-state is-error", [
    "switch-pokemon",
  ]);
  renderFloatingRouteNotFound(slug);
}

function routeSourceLabel(slug: string, source: PokemonRouteSource): string {
  if (source === "pathname") {
    return `/pokemon/${slug}/`;
  }
  if (source === "hash") {
    return `#${slug}`;
  }
  return `default:${slug}`;
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

  els.title.innerHTML = pokemonTitleHtml(pokemon);
  els.selectedPortrait.src = pokemon.image;
  els.selectedPortrait.alt = pokemonAltText(pokemon, state.locale);
  els.portraitNumber.textContent = pokemon.sequence;

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
  els.floatName.textContent = pokemonDisplayName(pokemon);
  els.floatMeta.innerHTML = `
    <span>No. ${pokemon.sequence}</span>
  `;
}

function renderFloatingRouteNotFound(slug: string): void {
  els.floatPortrait.removeAttribute("src");
  els.floatPortrait.alt = "";
  els.floatName.textContent = text().notFoundPokemon;
  els.floatMeta.innerHTML = `
    <span>${escapeHtml(slug || "unknown")}</span>
  `;
}

function renderInspector(pokemon: SelectedPokemon): void {
  renderPalette(pokemon.palette);
  renderPattern(pokemon.palette);
  renderRecommendations();
}

function renderPalette(palette: PaletteColor[]): void {
  els.paletteTotal.textContent = text().paletteCount(palette.length);
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
  els.patternTotal.textContent = text().patternCount(cells);

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
  const labels = text();
  els.itemSectionTitle.textContent = labels.recommendationTitle(state.itemCategory);

  const selected = state.selected;
  const panel = state.recommendations;
  if (!selected || panel.status === "idle" || panel.status === "loading" || panel.slug !== selected.slug) {
    renderRecommendationState(labels.loadingRecommendations, "recommendation-state");
    return;
  }

  if (panel.status === "error") {
    renderRecommendationState(
      labels.recommendationError(panel.error || ""),
      "recommendation-state is-error",
      ["retry", "switch-pokemon"],
    );
    return;
  }

  if (!panel.data) {
    renderRecommendationState(labels.recommendationsUnavailable, "recommendation-state is-error", [
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
        ? labels.emptyRecommendations
        : labels.emptyFilter;
    renderRecommendationState(
      message,
      "recommendation-state",
      panel.data.recommendations.length === 0 ? ["switch-pokemon"] : ["reset-filter"],
    );
    return;
  }

  const start = pageIndex * panel.data.pageSize;
  const pageItems = filtered.slice(start, start + panel.data.pageSize);
  els.furnitureGrid.innerHTML = `
    <div class="recommendation-summary" aria-live="polite">
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
      <span>${escapeHtml(text().sparseRecommendations(recommendationCount))}</span>
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
  const labels = text();
  switch (action) {
    case "retry":
      return `<button class="recommendation-retry" type="button" data-recommendation-action="retry">${escapeHtml(labels.retry)}</button>`;
    case "switch-pokemon":
      return `<button class="recommendation-retry" type="button" data-recommendation-action="switch-pokemon">${escapeHtml(labels.switchPokemon)}</button>`;
    case "reset-filter":
      return `<button class="recommendation-retry" type="button" data-recommendation-action="reset-filter">${escapeHtml(labels.resetFilter)}</button>`;
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
  const labels = text();
  const displayName = recommendationDisplayName(entry);
  const category = categoryLabel(entry.category || item?.category || "Other");
  const terms = entry.matchedPreferenceTerms.map((term) => `<span>${escapeHtml(preferenceTermLabel(term))}</span>`).join("");
  const color = entry.itemPrimaryColor;
  const dyeColors = entry.recommendedDyeColors.length > 0
    ? entry.recommendedDyeColors.map((dyeColor) => `<span>${escapeHtml(dyeColorLabel(dyeColor))}</span>`).join("")
    : `<span>${escapeHtml(labels.none)}</span>`;

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
        <dl class="recommendation-facts">
          <div>
            <dt>${escapeHtml(labels.fieldCategory)}</dt>
            <dd>${escapeHtml(category)}</dd>
          </div>
          <div>
            <dt>${escapeHtml(labels.fieldDyeable)}</dt>
            <dd>${entry.isDyeable ? escapeHtml(labels.yes) : escapeHtml(labels.no)}</dd>
          </div>
          ${
            entry.isDyeable
              ? `<div class="preference-cell">
                  <dt>${escapeHtml(labels.fieldDyeColors)}</dt>
                  <dd class="preference-tags">${dyeColors}</dd>
                </div>`
              : ""
          }
          <div>
            <dt>${escapeHtml(labels.fieldPrimaryColor)}</dt>
            <dd class="color-value">
              ${color ? `<span class="color-chip" style="background:${escapeHtml(color)}"></span>${escapeHtml(color)}` : escapeHtml(labels.none)}
            </dd>
          </div>
          <div class="preference-cell">
            <dt>${escapeHtml(labels.fieldPreferenceTerms)}</dt>
            <dd class="preference-tags">${terms}</dd>
          </div>
        </dl>
      </div>
    </article>
  `;
}

function renderRecommendationPagination(pageIndex: number, totalPages: number): string {
  const hasPrevious = pageIndex > 0;
  const hasNext = pageIndex < totalPages - 1;
  const labels = text();
  return `
    <nav class="recommendation-pagination" aria-label="${escapeHtml(labels.paginationAria)}">
      <button
        type="button"
        data-recommendation-page="previous"
        aria-label="${escapeHtml(labels.previousPageAria)}"
        ${hasPrevious ? "" : "disabled"}>
        ${escapeHtml(labels.previousPage)}
      </button>
      <span>${escapeHtml(labels.pageLabel(pageIndex + 1, totalPages))}</span>
      <button
        type="button"
        data-recommendation-page="next"
        aria-label="${escapeHtml(labels.nextPageAria)}"
        ${hasNext ? "" : "disabled"}>
        ${escapeHtml(labels.nextPage)}
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
  if (isSeedRecommendation(entry)) {
    return false;
  }

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

function isSeedRecommendation(entry: RecommendationEntry): boolean {
  const item = state.itemBySlug.get(entry.itemSlug);
  const zhName = entry.itemZhName || item?.zh || "";
  if (zhName.endsWith("种子")) {
    return true;
  }

  const englishName = (entry.itemName || item?.name || "").toLowerCase();
  return /(?:^|[-\s])seeds?$/.test(englishName);
}

function recommendationDisplayName(entry: RecommendationEntry): string {
  const item = state.itemBySlug.get(entry.itemSlug);
  if (state.locale === "zh") {
    return entry.itemZhName || item?.zh || entry.itemName || item?.name || entry.itemSlug;
  }
  return entry.itemName || item?.name || entry.itemSlug;
}

function pokemonPrimaryDisplayName(pokemon: Pokemon): string {
  return state.locale === "zh" ? pokemon.zh : pokemon.name;
}

function pokemonSecondaryDisplayName(pokemon: Pokemon): string {
  if (state.locale === "zh") {
    return pokemon.name;
  }
  return pokemon.slug;
}

function pokemonDisplayName(pokemon: Pokemon): string {
  if (state.locale === "zh" && pokemon.zh !== pokemon.name) {
    return `${pokemon.zh} / ${pokemon.name}`;
  }
  return pokemon.name;
}

function pokemonTitleHtml(pokemon: Pokemon): string {
  if (state.locale === "zh" && pokemon.zh !== pokemon.name) {
    return `${escapeHtml(pokemon.zh)} <em>${escapeHtml(pokemon.name)}</em>`;
  }
  return escapeHtml(pokemon.name);
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
  const labels = text();
  const fileLabel = error instanceof GeneratedDataError ? ` (${error.filePath})` : "";
  const message = error instanceof Error ? error.message : String(error);
  const errorBox = document.createElement("div");
  const title = document.createElement("strong");
  const hint = document.createElement("span");
  const detail = document.createElement("code");
  const retry = document.createElement("button");

  errorBox.className = "loading-error";
  title.textContent = labels.bootErrorTitle(fileLabel);
  hint.textContent = labels.bootErrorHint;
  detail.className = "error-detail";
  detail.textContent = message;
  retry.type = "button";
  retry.textContent = labels.reload;
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
