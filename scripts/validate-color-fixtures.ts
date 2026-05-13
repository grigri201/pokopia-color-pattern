import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { validatePokemonMetadataOverridesData } from "../src/data/schemas.js";
import { DEFAULT_FALLBACK_COLOR, extractImagePalette } from "./lib/image-colors.js";

const fixtureDir = ".tmp/color-fixtures";

await mkdir(fixtureDir, { recursive: true });

const transparentRed = join(fixtureDir, "transparent-red.png");
const whiteNoise = join(fixtureDir, "white-noise.png");
const missing = join(fixtureDir, "missing.png");

await sharp({
  create: {
    width: 4,
    height: 4,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="4" height="4"><rect x="1" y="1" width="2" height="2" fill="#CC3344"/></svg>',
      ),
      top: 0,
      left: 0,
    },
  ])
  .png()
  .toFile(transparentRed);

await sharp({
  create: {
    width: 4,
    height: 4,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .png()
  .toFile(whiteNoise);

const redResult = await extractImagePalette(transparentRed);
if (redResult.status !== "ok" || redResult.palette[0]?.hex === DEFAULT_FALLBACK_COLOR) {
  throw new Error("Expected transparent fixture to extract visible red pixels");
}

const whiteResult = await extractImagePalette(whiteNoise);
if (whiteResult.status !== "fallback" || whiteResult.reason !== "no_visible_pixels") {
  throw new Error("Expected near-white fixture to fallback after background filtering");
}

const missingResult = await extractImagePalette(missing);
if (missingResult.status !== "fallback" || !missingResult.reason.startsWith("decode_failed:")) {
  throw new Error("Expected missing image fixture to produce decode fallback");
}

const validOverrideIssues = validatePokemonMetadataOverridesData({
  schemaVersion: "pokemon-metadata-overrides.v1",
  pokemon: {
    ditto: {
      primaryColor: "#AABBCC",
      palette: ["#AABBCC", "#112233", "#445566"],
      pattern: ["soft", "round"],
    },
  },
});
if (validOverrideIssues.length > 0) {
  throw new Error(`Expected valid Pokemon metadata override fixture: ${JSON.stringify(validOverrideIssues)}`);
}

const invalidOverrideIssues = validatePokemonMetadataOverridesData({
  schemaVersion: "pokemon-metadata-overrides.v1",
  pokemon: {
    ditto: {
      primaryColor: "not-a-color",
    },
  },
});
if (invalidOverrideIssues.length === 0) {
  throw new Error("Expected invalid Pokemon metadata override fixture to fail validation");
}

await writeFile(join(fixtureDir, "ok.txt"), "color fixtures passed\n", "utf8");
console.log("Validated color extraction and override fixtures.");
