import sharp from "sharp";

export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type ExtractedColor = {
  hex: string;
  rgb: Rgb;
  percent: number;
};

export type ImagePaletteResult =
  | {
      status: "ok";
      palette: ExtractedColor[];
    }
  | {
      status: "fallback";
      reason: string;
    };

type WeightedColor = {
  rgb: Rgb;
  count: number;
  score: number;
};

export const DEFAULT_FALLBACK_COLOR = "#B8B0A4";

export async function extractImagePalette(filePath: string): Promise<ImagePaletteResult> {
  try {
    const { data, info } = await sharp(filePath)
      .rotate()
      .ensureAlpha()
      .resize({ width: 128, height: 128, fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buckets = new Map<string, WeightedColor>();
    let visible = 0;

    for (let index = 0; index < data.length; index += info.channels) {
      const alpha = data[index + 3] ?? 255;
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
      const current = buckets.get(key) ?? {
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

    if (visible === 0 || buckets.size === 0) {
      return { status: "fallback", reason: "no_visible_pixels" };
    }

    const palette = Array.from(buckets.values())
      .sort((left, right) => right.score - left.score)
      .reduce<WeightedColor[]>((acc, color) => {
        const close = acc.find((item) => colorDistance(item.rgb, color.rgb) < 30);
        if (close) {
          const previousCount = close.count;
          close.count += color.count;
          close.score += color.score;
          close.rgb = weightedRgb(close.rgb, color.rgb, previousCount, color.count);
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
        percent: roundPercent((color.count / visible) * 100),
      }));

    if (palette.length === 0) {
      return { status: "fallback", reason: "palette_empty_after_filtering" };
    }

    return { status: "ok", palette };
  } catch (error) {
    return {
      status: "fallback",
      reason: `decode_failed:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function rgbToHex(rgb: Rgb): string {
  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`;
}

function toHexChannel(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase();
}

function quantize(rgb: Rgb, step: number): Rgb {
  return {
    r: Math.round(rgb.r / step) * step,
    g: Math.round(rgb.g / step) * step,
    b: Math.round(rgb.b / step) * step,
  };
}

function weightedRgb(base: Rgb, next: Rgb, baseCount: number, nextCount: number): Rgb {
  const total = baseCount + nextCount;
  return {
    r: Math.round((base.r * baseCount + next.r * nextCount) / total),
    g: Math.round((base.g * baseCount + next.g * nextCount) / total),
    b: Math.round((base.b * baseCount + next.b * nextCount) / total),
  };
}

function colorDistance(left: Rgb, right: Rgb): number {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHsl(rgb: Rgb): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }

  return { h: (h * 60 + 360) % 360, s, l };
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}
