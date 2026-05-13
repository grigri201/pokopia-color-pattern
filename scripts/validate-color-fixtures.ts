import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { validatePokemonMetadataOverridesData } from "../src/data/schemas.js";
import { resolvePokemonMetadataOverrideFields } from "../src/domain/pokemon-metadata.js";
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
      recommendedItems: {
        mode: "append",
        items: [{ itemSlug: "flower-chair", matchedPreferenceTerms: ["flower"] }],
      },
    },
  },
});
if (validOverrideIssues.length > 0) {
  throw new Error(`Expected valid Pokemon metadata override fixture: ${JSON.stringify(validOverrideIssues)}`);
}

const overrideFields = resolvePokemonMetadataOverrideFields(
  "ditto",
  {
    primaryColor: "#AABBCC",
    palette: ["#AABBCC", "#112233", "#445566"],
    pattern: ["soft", "round"],
    recommendedItems: {
      mode: "append",
      items: [{ itemSlug: "flower-chair", matchedPreferenceTerms: ["flower"] }],
    },
  },
  "fixture-overrides.json",
  DEFAULT_FALLBACK_COLOR,
);
if (
  overrideFields.overrideSource !== "fixture-overrides.json#pokemon.ditto" ||
  overrideFields.overridePrimaryColor !== "#AABBCC" ||
  overrideFields.overridePalette.length !== 3 ||
  overrideFields.overridePattern?.join(",") !== "soft,round"
) {
  throw new Error(`Expected metadata override fields to be resolved for generated Pokemon metadata: ${JSON.stringify(overrideFields)}`);
}

assertOverrideIssue(
  "invalid primary color",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        primaryColor: "not-a-color",
      },
    },
  },
  "$.pokemon.ditto.primaryColor",
);
assertOverrideIssue(
  "invalid recommended item mode",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        recommendedItems: {
          mode: "sideways",
          items: [{ itemSlug: "flower-chair", matchedPreferenceTerms: ["flower"] }],
        },
      },
    },
  },
  "$.pokemon.ditto.recommendedItems.mode",
);
assertOverrideIssue(
  "empty recommended items",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        recommendedItems: {
          mode: "append",
          items: [],
        },
      },
    },
  },
  "$.pokemon.ditto.recommendedItems.items",
);
assertOverrideIssue(
  "missing recommended items",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        recommendedItems: {
          mode: "append",
        },
      },
    },
  },
  "$.pokemon.ditto.recommendedItems.items",
);
assertOverrideIssue(
  "duplicate recommended item",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        recommendedItems: {
          mode: "append",
          items: [
            { itemSlug: "flower-chair", matchedPreferenceTerms: ["flower"] },
            { itemSlug: "flower-chair", matchedPreferenceTerms: ["manual"] },
          ],
        },
      },
    },
  },
  "$.pokemon.ditto.recommendedItems.items[1].itemSlug",
);
assertOverrideIssue(
  "empty matched preference terms",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        recommendedItems: {
          mode: "append",
          items: [{ itemSlug: "flower-chair", matchedPreferenceTerms: [] }],
        },
      },
    },
  },
  "$.pokemon.ditto.recommendedItems.items[0].matchedPreferenceTerms",
);
assertOverrideIssue(
  "non-normalized matched preference term",
  {
    schemaVersion: "pokemon-metadata-overrides.v1",
    pokemon: {
      ditto: {
        recommendedItems: {
          mode: "append",
          items: [{ itemSlug: "flower-chair", matchedPreferenceTerms: [" Flower "] }],
        },
      },
    },
  },
  "$.pokemon.ditto.recommendedItems.items[0].matchedPreferenceTerms[0]",
);

await writeFile(join(fixtureDir, "ok.txt"), "color fixtures passed\n", "utf8");
console.log("Validated color extraction and override fixtures.");

function assertOverrideIssue(label: string, data: unknown, expectedPath: string): void {
  const issues = validatePokemonMetadataOverridesData(data);
  if (!issues.some((issue) => issue.path === expectedPath)) {
    throw new Error(`Expected ${label} override fixture to fail at ${expectedPath}: ${JSON.stringify(issues)}`);
  }
}
