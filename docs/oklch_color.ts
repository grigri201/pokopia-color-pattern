/**
 * OKLCH 配色方法论，写成可执行的 TypeScript。
 *
 * 实用流程：
 * 1. 把任意 hex 颜色转换成 OKLCH。
 * 2. 用色相旋转找到类似、互补、分裂互补、三角等候选关系。
 * 3. 用明度和彩度把候选色调成可用的家具/空间颜色。
 * 4. 给颜色分配空间角色，并用面积比例控制视觉重量。
 */

export type HexColor = `#${string}`;

export interface Rgb {
  /** 0-255 sRGB 红色通道。 */
  r: number;
  /** 0-255 sRGB 绿色通道。 */
  g: number;
  /** 0-255 sRGB 蓝色通道。 */
  b: number;
}

export interface Oklch {
  /** 感知明度，通常为 0-1。 */
  l: number;
  /** 感知彩度。在 sRGB 中，实用值通常落在 0-0.35。 */
  c: number;
  /** 色相角度，单位为度，并规范化到 0-360。 */
  h: number;
}

export interface HarmonyColors {
  base: HexColor;
  baseOklch: Oklch;
  analogous: readonly [HexColor, HexColor];
  complementary: HexColor;
  splitComplementary: readonly [HexColor, HexColor];
  triadic: readonly [HexColor, HexColor];
  monochrome: readonly [HexColor, HexColor, HexColor];
}

export interface PaletteRole {
  role: "base" | "background" | "supportingFurniture" | "accent" | "darkAnchor";
  color: HexColor;
  oklch: Oklch;
  areaRatio: string;
  method: string;
  usage: string;
}

export interface InteriorPalette {
  source: HexColor;
  roles: readonly PaletteRole[];
}

export interface PaletteExplanation {
  source: HexColor;
  sourceOklch: Oklch;
  principle: string;
  palette: InteriorPalette;
  harmony: HarmonyColors;
}

export interface DisplayableColor {
  hex: HexColor;
  oklch: Oklch;
  /**
   * true 表示原始 OKLCH 超出 sRGB 显示范围，需要降低彩度，
   * 或在最后一步对 RGB 做轻微裁剪。
   */
  wasClamped: boolean;
  /** 1 表示保留原始彩度；数值越低，表示为进入色域而削弱得越多。 */
  chromaScale: number;
}

interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

interface Oklab {
  l: number;
  a: number;
  b: number;
}

const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/;

export const EXAMPLE_SOURCE_HEX = "#D05A6E" as const;
export const EXAMPLE_INTERIOR_PALETTE = buildInteriorPalette(EXAMPLE_SOURCE_HEX);

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex(rgb: Rgb): HexColor {
  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`;
}

export function hexToOklch(hex: string): Oklch {
  return oklabToOklch(linearRgbToOklab(rgbToLinearRgb(hexToRgb(hex))));
}

export function oklchToHex(oklch: Oklch): HexColor {
  return clampToDisplayableColor(oklch).hex;
}

export function rotateHue(oklch: Oklch, degrees: number): Oklch {
  return {
    ...oklch,
    h: normalizeHue(oklch.h + degrees),
  };
}

export function scaleChroma(oklch: Oklch, scale: number): Oklch {
  return {
    ...oklch,
    c: Math.max(0, oklch.c * scale),
  };
}

export function shiftLightness(oklch: Oklch, amount: number): Oklch {
  return {
    ...oklch,
    l: clamp(oklch.l + amount, 0, 1),
  };
}

export function clampToDisplayableColor(oklch: Oklch): DisplayableColor {
  const normalized = normalizeOklch(oklch);

  if (isDisplayable(normalized)) {
    return {
      hex: linearRgbToHex(oklchToLinearRgb(normalized)),
      oklch: normalized,
      wasClamped: false,
      chromaScale: 1,
    };
  }

  let low = 0;
  let high = 1;
  let best = { ...normalized, c: 0 };

  for (let i = 0; i < 32; i += 1) {
    const scale = (low + high) / 2;
    const candidate = { ...normalized, c: normalized.c * scale };

    if (isDisplayable(candidate)) {
      best = candidate;
      low = scale;
    } else {
      high = scale;
    }
  }

  return {
    hex: linearRgbToHex(clampLinearRgb(oklchToLinearRgb(best))),
    oklch: best,
    wasClamped: true,
    chromaScale: normalized.c === 0 ? 0 : best.c / normalized.c,
  };
}

export function getHarmonyColors(baseHex: string): HarmonyColors {
  const base = normalizeHex(baseHex);
  const baseOklch = hexToOklch(base);

  return {
    base,
    baseOklch,
    analogous: [
      tone(rotateHue(baseOklch, -30), { chromaScale: 0.8, lightnessShift: 0.04 }),
      tone(rotateHue(baseOklch, 30), { chromaScale: 0.8, lightnessShift: 0.04 }),
    ],
    complementary: tone(rotateHue(baseOklch, 180), { chromaScale: 0.55, lightnessShift: -0.03 }),
    splitComplementary: [
      tone(rotateHue(baseOklch, 150), { chromaScale: 0.5, lightnessShift: 0.02 }),
      tone(rotateHue(baseOklch, 210), { chromaScale: 0.5, lightnessShift: 0.02 }),
    ],
    triadic: [
      tone(rotateHue(baseOklch, 120), { chromaScale: 0.45, lightnessShift: 0 }),
      tone(rotateHue(baseOklch, 240), { chromaScale: 0.45, lightnessShift: 0 }),
    ],
    monochrome: [
      tone(baseOklch, { chromaScale: 0.18, lightness: 0.92 }),
      tone(baseOklch, { chromaScale: 0.42, lightness: 0.74 }),
      tone(baseOklch, { chromaScale: 0.65, lightness: 0.36 }),
    ],
  };
}

export function buildInteriorPalette(baseHex: string): InteriorPalette {
  const source = normalizeHex(baseHex);
  const baseOklch = hexToOklch(source);

  const background = withTone(baseOklch, {
    hueShift: 12,
    chromaScale: 0.08,
    lightness: 0.94,
  });
  const supportingFurniture = withTone(baseOklch, {
    hueShift: 180,
    chromaScale: 0.36,
    lightness: 0.68,
  });
  const accent = withTone(baseOklch, {
    hueShift: 150,
    chromaScale: 0.55,
    lightness: 0.62,
  });
  const darkAnchor = withTone(baseOklch, {
    hueShift: 185,
    chromaScale: 0.28,
    lightness: 0.24,
  });

  return {
    source,
    roles: [
      {
        role: "base",
        color: source,
        oklch: baseOklch,
        areaRatio: "10-30%",
        method: "保留原始颜色，把它当作空间里的视觉主角。",
        usage: "用于主物件，例如沙发、柜门、重点织物或需要被一眼看到的家具。",
      },
      {
        role: "background",
        color: background.hex,
        oklch: background.oklch,
        areaRatio: "50-70%",
        method: "色相靠近主色，显著提高明度，并大幅降低彩度。",
        usage: "用于墙面、窗帘、大地毯等大面积安静表面。",
      },
      {
        role: "supportingFurniture",
        color: supportingFurniture.hex,
        oklch: supportingFurniture.oklch,
        areaRatio: "20-35%",
        method: "取低彩度互补方向，让对比存在但不刺眼。",
        usage: "用于单椅、收纳柜、木质相邻饰面或次要软装。",
      },
      {
        role: "accent",
        color: accent.hex,
        oklch: accent.oklch,
        areaRatio: "5-10%",
        method: "取分裂互补方向，并保留中等彩度。",
        usage: "用于抱枕、灯具、花器、装饰画细节或小件摆设。",
      },
      {
        role: "darkAnchor",
        color: darkAnchor.hex,
        oklch: darkAnchor.oklch,
        areaRatio: "5-15%",
        method: "降低明度形成视觉重量，避免整套配色发飘。",
        usage: "用于细金属脚、画框、小边几、置物架或线性结构。",
      },
    ],
  };
}

export function explainPalette(baseHex: string): PaletteExplanation {
  const source = normalizeHex(baseHex);

  return {
    source,
    sourceOklch: hexToOklch(source),
    principle:
      "色相决定颜色关系，明度决定层次，彩度决定柔和程度，面积比例决定颜色显得高级还是吵闹。",
    palette: buildInteriorPalette(source),
    harmony: getHarmonyColors(source),
  };
}

function normalizeHex(hex: string): HexColor {
  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`Expected a 6-digit hex color like "#D05A6E" or "D05A6E", received "${hex}".`);
  }

  const body = hex.startsWith("#") ? hex.slice(1) : hex;
  return `#${body.toUpperCase()}`;
}

function toHexChannel(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`RGB channel must be a finite number, received ${value}.`);
  }

  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0").toUpperCase();
}

function rgbToLinearRgb(rgb: Rgb): LinearRgb {
  return {
    r: srgbToLinear(rgb.r / 255),
    g: srgbToLinear(rgb.g / 255),
    b: srgbToLinear(rgb.b / 255),
  };
}

function linearRgbToHex(rgb: LinearRgb): HexColor {
  return rgbToHex({
    r: linearToSrgb(rgb.r) * 255,
    g: linearToSrgb(rgb.g) * 255,
    b: linearToSrgb(rgb.b) * 255,
  });
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const safeValue = clamp(value, 0, 1);
  return safeValue <= 0.0031308 ? 12.92 * safeValue : 1.055 * safeValue ** (1 / 2.4) - 0.055;
}

function linearRgbToOklab(rgb: LinearRgb): Oklab {
  const l = 0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b;
  const m = 0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b;
  const s = 0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function oklabToLinearRgb(oklab: Oklab): LinearRgb {
  const lRoot = oklab.l + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const mRoot = oklab.l - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const sRoot = oklab.l - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function oklabToOklch(oklab: Oklab): Oklch {
  const c = Math.sqrt(oklab.a ** 2 + oklab.b ** 2);
  const rawHue = Math.atan2(oklab.b, oklab.a) * (180 / Math.PI);

  return {
    l: oklab.l,
    c,
    h: normalizeHue(rawHue),
  };
}

function oklchToOklab(oklch: Oklch): Oklab {
  const radians = normalizeHue(oklch.h) * (Math.PI / 180);

  return {
    l: oklch.l,
    a: oklch.c * Math.cos(radians),
    b: oklch.c * Math.sin(radians),
  };
}

function oklchToLinearRgb(oklch: Oklch): LinearRgb {
  return oklabToLinearRgb(oklchToOklab(oklch));
}

function withTone(
  base: Oklch,
  options: {
    hueShift?: number;
    chromaScale?: number;
    lightness?: number;
    lightnessShift?: number;
  },
): DisplayableColor {
  const shifted = rotateHue(base, options.hueShift ?? 0);
  const scaled = scaleChroma(shifted, options.chromaScale ?? 1);
  const adjusted =
    options.lightness === undefined
      ? shiftLightness(scaled, options.lightnessShift ?? 0)
      : { ...scaled, l: clamp(options.lightness, 0, 1) };

  return clampToDisplayableColor(adjusted);
}

function tone(
  base: Oklch,
  options: {
    chromaScale?: number;
    lightness?: number;
    lightnessShift?: number;
  },
): HexColor {
  return withTone(base, options).hex;
}

function normalizeOklch(oklch: Oklch): Oklch {
  assertFinite("lightness", oklch.l);
  assertFinite("chroma", oklch.c);
  assertFinite("hue", oklch.h);

  return {
    l: clamp(oklch.l, 0, 1),
    c: Math.max(0, oklch.c),
    h: normalizeHue(oklch.h),
  };
}

function isDisplayable(oklch: Oklch): boolean {
  const rgb = oklchToLinearRgb(oklch);
  return isUnitInterval(rgb.r) && isUnitInterval(rgb.g) && isUnitInterval(rgb.b);
}

function isUnitInterval(value: number): boolean {
  const epsilon = 0.0000001;
  return value >= -epsilon && value <= 1 + epsilon;
}

function clampLinearRgb(rgb: LinearRgb): LinearRgb {
  return {
    r: clamp(rgb.r, 0, 1),
    g: clamp(rgb.g, 0, 1),
    b: clamp(rgb.b, 0, 1),
  };
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`OKLCH ${name} must be a finite number, received ${value}.`);
  }
}
