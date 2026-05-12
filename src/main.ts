import "./styles.css";

const POKEMON_MANIFEST = "docs/pokopia_image_sources/pokemon_portraits/manifest.csv";
const ITEM_MANIFEST = "docs/pokopia_image_sources/item_portraits/manifest.csv";
const DEFAULT_POKEMON = "ditto";
const ITEM_FILTER_KEYS = ["全部", "家具", "装饰", "玩具", "地块", "食物"] as const;
const POKEMON_RANGES = ["all", "early", "late"] as const;

type ItemFilter = (typeof ITEM_FILTER_KEYS)[number];
type PokemonRange = (typeof POKEMON_RANGES)[number];
type CsvRecord = Record<string, string>;
type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };
type Cmyk = { c: number; m: number; y: number; k: number };
type PaletteColor = { rgb: Rgb; hex: string; percent: number };
type NormalizedPaletteColor = PaletteColor & { ratio: number };
type WeightedColor = { rgb: Rgb; count: number; score: number };
type PaletteTone = "NEUTRAL" | "ROSE" | "AMBER" | "GREEN" | "BLUE" | "VIOLET" | "MAGENTA";

type Pokemon = {
  sequence: string;
  name: string;
  zh: string;
  slug: string;
  image: string;
  source: string;
};

type SelectedPokemon = Pokemon & {
  palette: PaletteColor[];
};

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

type ScoredItem = PlaceableItem & { score: number };
type FurnitureSlot =
  | { state: "candidate"; label: string; item: ScoredItem }
  | { state: "reserved"; label: string };

const paletteCache = new Map<string, PaletteColor[]>();
const ITEM_FILTERS: Record<ItemFilter, (item: PlaceableItem) => boolean> = {
  全部: () => true,
  家具: (item) => item.category === "Furniture",
  装饰: (item) => item.tags.includes("Decoration"),
  玩具: (item) => item.tags.includes("Toy"),
  地块: (item) => item.category === "Blocks" || item.tags.includes("Road"),
  食物: (item) => item.category === "Food" || item.tags.includes("Food"),
};

const state: {
  pokemon: Pokemon[];
  items: PlaceableItem[];
  selected: SelectedPokemon | null;
  query: string;
  range: PokemonRange;
  itemCategory: ItemFilter;
} = {
  pokemon: [],
  items: [],
  selected: null,
  query: "",
  range: "all",
  itemCategory: "全部",
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

function isPokemonRange(value: string | undefined): value is PokemonRange {
  return value !== undefined && POKEMON_RANGES.includes(value as PokemonRange);
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
  const [pokemonCsv, itemCsv] = await Promise.all([
    fetch(POKEMON_MANIFEST).then((res) => res.text()),
    fetch(ITEM_MANIFEST).then((res) => res.text()),
  ]);

  state.pokemon = parseCsv(pokemonCsv)
    .filter((row) => row.status === "ok" && row.kind === "pokemon")
    .map((row) => ({
      sequence: row.sequence,
      name: row.name,
      zh: row.name_zh_hans,
      slug: slugify(row.name),
      image: row.relative_path,
      source: row.source,
    }));

  state.items = parseCsv(itemCsv)
    .filter((row) => row.status === "ok" && row.kind === "placeable_item")
    .map((row, index) => ({
      index,
      id: row.id,
      name: row.name,
      zh: row.name,
      slug: row.slug,
      category: row.category,
      tags: parseJsonArray(row.tags),
      event: row.event,
      image: row.relative_path,
      source: row.source,
    }));

  bindEvents();
  renderList();

  const hashSlug = slugify(decodeURIComponent(location.hash.replace(/^#/, "")));
  const initial =
    state.pokemon.find((pokemon) => pokemon.slug === hashSlug) ||
    state.pokemon.find((pokemon) => pokemon.slug === DEFAULT_POKEMON) ||
    state.pokemon[0];

  if (!initial) {
    throw new Error("No Pokemon portraits found in manifest");
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
    }
    if (state.selected) {
      renderFurniture(state.selected);
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      if (isPokemonRange(button.dataset.range)) {
        state.range = button.dataset.range;
      }
      document
        .querySelectorAll<HTMLButtonElement>("[data-range]")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      renderList();
    });
  });

  window.addEventListener("hashchange", () => {
    const slug = slugify(decodeURIComponent(location.hash.replace(/^#/, "")));
    if (slug && (!state.selected || slug !== state.selected.slug)) {
      selectPokemon(slug, false);
    }
  });
}

function renderList(): void {
  const filtered = state.pokemon.filter((pokemon) => {
    const index = Number(pokemon.sequence);
    const matchesRange =
      state.range === "all" ||
      (state.range === "early" && index <= 120) ||
      (state.range === "late" && index > 120);
    const haystack = `${pokemon.sequence} ${pokemon.name} ${pokemon.zh}`.toLowerCase();
    return matchesRange && (!state.query || haystack.includes(state.query));
  });

  els.resultCount.textContent = String(filtered.length).padStart(3, "0");
  els.pokemonList.innerHTML = filtered
    .map(
      (pokemon) => `
        <li>
          <button class="pokemon-item${state.selected?.slug === pokemon.slug ? " is-active" : ""}"
            type="button"
            data-slug="${pokemon.slug}"
            aria-label="${escapeHtml(pokemon.zh)} ${escapeHtml(pokemon.name)}">
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
    button.addEventListener("click", async () => {
      if (button.dataset.slug) {
        await selectPokemon(button.dataset.slug);
      }
      closeDrawer();
    });
  });
}

function openDrawer(): void {
  document.body.classList.add("drawer-open");
  els.drawer.setAttribute("aria-hidden", "false");
  els.drawerTrigger.setAttribute("aria-expanded", "true");
  window.setTimeout(() => els.searchInput.focus(), 120);
}

function closeDrawer(): void {
  document.body.classList.remove("drawer-open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawerTrigger.setAttribute("aria-expanded", "false");
}

async function selectPokemon(slug: string, updateHash = true): Promise<void> {
  const pokemon = state.pokemon.find((item) => item.slug === slug) || state.pokemon[0];
  if (!pokemon) {
    return;
  }

  const palette = await getPalette(pokemon);
  const selected: SelectedPokemon = { ...pokemon, palette };
  state.selected = selected;

  if (updateHash) {
    history.replaceState(null, "", `#${pokemon.slug}`);
  }

  renderList();
  renderStage(selected);
  renderInspector(selected);
  renderFloatingPokemon(selected);
}

async function getPalette(pokemon: Pokemon): Promise<PaletteColor[]> {
  const cached = paletteCache.get(pokemon.slug);
  if (cached) {
    return cached;
  }

  const palette = await extractPalette(pokemon.image);
  paletteCache.set(pokemon.slug, palette);
  return palette;
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
  els.selectedPortrait.alt = `${pokemon.zh} ${pokemon.name}`;
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
  renderFurniture(pokemon);
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

function renderFurniture(pokemon: SelectedPokemon): void {
  const primary = pokemon.palette[0] || fallbackColor(pokemon.slug);
  els.itemSectionTitle.textContent = state.itemCategory;

  const filter = ITEM_FILTERS[state.itemCategory];
  const matches = state.items
    .filter(filter)
    .map((item) => ({
      ...item,
      score: furnitureScore(item, primary, pokemon.slug),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const slots: FurnitureSlot[] = [
    ...matches.map(
      (item, index): FurnitureSlot => ({
        state: "candidate",
        label: `Match ${String(index + 1).padStart(2, "0")}`,
        item,
      }),
    ),
    { state: "reserved", label: "Reserve 05" },
    { state: "reserved", label: "Reserve 06" },
  ];

  els.furnitureGrid.innerHTML = slots
    .map((slot) => {
      if (slot.state === "reserved") {
        return `
          <article class="slot">
            <div class="slot-visual"><span class="empty-mark">+</span></div>
            <div class="slot-name">
              <strong>家具色板位</strong>
              <span>Reserved</span>
            </div>
            <span class="slot-state">${slot.label}</span>
          </article>
        `;
      }

      return `
        <article class="slot">
          <div class="slot-visual">
            <img src="${slot.item.image}" alt="${escapeHtml(slot.item.zh)}" loading="lazy" />
          </div>
          <div class="slot-name">
            <strong>${escapeHtml(slot.item.zh)}</strong>
            <span>${escapeHtml(itemMetaLabel(slot.item))}</span>
          </div>
          <span class="slot-state">${slot.label}</span>
        </article>
      `;
    })
    .join("");
}

async function extractPalette(src: string): Promise<PaletteColor[]> {
  const image = await loadImage(src);
  const size = 128;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return [fallbackColor(src)];
  }
  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);

  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);
  context.drawImage(image, x, y, width, height);

  const { data } = context.getImageData(0, 0, size, size);
  const buckets = new Map<string, WeightedColor>();
  let visible = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 42) {
      continue;
    }

    const rgb: Rgb = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    };

    const hsl = rgbToHsl(rgb);
    if (hsl.l > 0.96 && hsl.s < 0.1) {
      continue;
    }

    visible += 1;
    const quantized = quantize(rgb, 24);
    const key = `${quantized.r},${quantized.g},${quantized.b}`;
    const current = buckets.get(key) || {
      rgb: quantized,
      count: 0,
      score: 0,
    };

    const saturationLift = 0.54 + hsl.s * 0.72;
    const outlinePenalty = hsl.l < 0.12 ? 0.42 : 1;
    current.count += 1;
    current.score += saturationLift * outlinePenalty;
    buckets.set(key, current);
  }

  const colors = Array.from(buckets.values())
    .sort((left, right) => right.score - left.score)
    .reduce<WeightedColor[]>((acc, color) => {
      const close = acc.find((item) => colorDistance(item.rgb, color.rgb) < 30);
      if (close) {
        close.count += color.count;
        close.score += color.score;
        close.rgb = weightedRgb(close.rgb, color.rgb, close.count, color.count);
      } else if (acc.length < 10) {
        acc.push({ ...color });
      }
      return acc;
    }, [])
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((color) => ({
      rgb: color.rgb,
      hex: rgbToHex(color.rgb),
      percent: visible ? (color.count / visible) * 100 : 0,
    }));

  return colors.length ? colors : [fallbackColor(src)];
}

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...body] = rows;
  return body.map((values) =>
    headers.reduce<CsvRecord>((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {}),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function slugify(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function quantize(rgb: Rgb, step: number): Rgb {
  return {
    r: clamp(Math.round(rgb.r / step) * step, 0, 255),
    g: clamp(Math.round(rgb.g / step) * step, 0, 255),
    b: clamp(Math.round(rgb.b / step) * step, 0, 255),
  };
}

function weightedRgb(left: Rgb, right: Rgb, leftCount: number, rightCount: number): Rgb {
  const total = leftCount + rightCount;
  return {
    r: Math.round((left.r * leftCount + right.r * rightCount) / total),
    g: Math.round((left.g * leftCount + right.g * rightCount) / total),
    b: Math.round((left.b * leftCount + right.b * rightCount) / total),
  };
}

function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  return { h, s, l };
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

function paletteTone(color: PaletteColor): PaletteTone {
  const hsl = rgbToHsl(color.rgb);
  if (hsl.s < 0.16) return "NEUTRAL";
  if (hsl.h < 24 || hsl.h >= 340) return "ROSE";
  if (hsl.h < 58) return "AMBER";
  if (hsl.h < 150) return "GREEN";
  if (hsl.h < 220) return "BLUE";
  if (hsl.h < 290) return "VIOLET";
  return "MAGENTA";
}

function normalizePalette(palette: PaletteColor[]): NormalizedPaletteColor[] {
  const total = palette.reduce((sum, color) => sum + color.percent, 0) || 1;
  return palette.map((color) => ({
    ...color,
    ratio: (color.percent / total) * 100,
  }));
}

function furnitureScore(item: PlaceableItem, color: PaletteColor, slug: string): number {
  const tone = paletteTone(color).toLowerCase() as Lowercase<PaletteTone>;
  const text = `${item.name} ${item.zh} ${item.category} ${item.tags.join(" ")}`.toLowerCase();
  const keywords: Record<Lowercase<PaletteTone>, string[]> = {
    rose: ["berry", "flower", "antique", "sofa", "bed"],
    amber: ["wood", "straw", "lamp", "camp", "table", "chair"],
    green: ["leaf", "plant", "garden", "flower", "grass"],
    blue: ["beach", "water", "ice", "avalugg", "glass"],
    violet: ["ghost", "mystic", "antique", "lamp"],
    magenta: ["berry", "flower", "sofa", "bed"],
    neutral: ["stone", "brick", "basic", "antique", "closet", "chest"],
  };
  const keywordScore = (keywords[tone] || []).reduce(
    (sum, word) => sum + (text.includes(word) ? 32 : 0),
    0,
  );
  return keywordScore + seededScore(`${slug}-${item.name}-${color.hex}`);
}

function itemMetaLabel(item: PlaceableItem): string {
  const tags = item.tags.length ? ` · ${item.tags.join(" / ")}` : "";
  const event = item.event ? ` · ${item.event}` : "";
  return `${item.category}${tags}${event}`;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
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

function colorDistance(left: Rgb, right: Rgb): number {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
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

boot().catch((error) => {
  console.error(error);
  els.loading.textContent = "无法读取 Pokopia 数据";
});
