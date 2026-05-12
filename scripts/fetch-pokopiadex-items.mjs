#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "docs", "pokopia_image_sources");
const IMAGE_ROOT = path.join(OUTPUT_ROOT, "item_portraits");
const SOURCE_PAGE = "https://pokopiadex.com/items?source=base";
const SOURCE_ORIGIN = "https://pokopiadex.com";
const EXPECTED_PLACEABLE_COUNT = 1219;

const CSV_HEADERS = [
  "kind",
  "id",
  "name",
  "slug",
  "description",
  "category",
  "tags",
  "sources",
  "event",
  "inventory_status",
  "collectible",
  "order_key",
  "order_value",
  "trade_sell_value",
  "trade_buy_value",
  "trade_buy_quantity",
  "life_coins",
  "shop_level",
  "mosslax",
  "storage_capacity",
  "habitat_item_category_ids",
  "favorite_category_ids",
  "image_url",
  "variant_image_urls",
  "source_page",
  "source",
];

const MANIFEST_HEADERS = [
  "sequence",
  ...CSV_HEADERS,
  "filename",
  "relative_path",
  "downloaded_url",
  "content_type",
  "bytes",
  "sha256",
  "status",
  "error",
];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await mkdir(IMAGE_ROOT, { recursive: true });

  const html = await fetchText(SOURCE_PAGE);
  const allItems = extractAllItems(html);
  const placeableItems = allItems.filter((item) => item.inventory_status === "in-collection");

  if (placeableItems.length !== EXPECTED_PLACEABLE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PLACEABLE_COUNT} placeable items, received ${placeableItems.length}`,
    );
  }

  const records = placeableItems.map(toRecord);
  const manifestRows = [];

  for (let index = 0; index < records.length; index += 1) {
    const sequence = String(index + 1).padStart(4, "0");
    const record = records[index];
    const filenameBase = `${sequence}-${record.slug || slugify(record.name)}`;
    const downloaded = await downloadImage(record.image_url, filenameBase);

    manifestRows.push({
      sequence,
      ...record,
      filename: downloaded.filename,
      relative_path: path.posix.join(
        "docs",
        "pokopia_image_sources",
        "item_portraits",
        downloaded.filename,
      ),
      downloaded_url: record.image_url,
      content_type: downloaded.contentType,
      bytes: downloaded.bytes,
      sha256: downloaded.sha256,
      status: downloaded.status,
      error: downloaded.error,
    });
  }

  await writeFile(
    path.join(OUTPUT_ROOT, "pokopiadex_placeable_items.csv"),
    toCsv(CSV_HEADERS, records),
  );
  await writeFile(
    path.join(OUTPUT_ROOT, "pokopiadex_placeable_items.json"),
    `${JSON.stringify(placeableItems, null, 2)}\n`,
  );
  await writeFile(
    path.join(IMAGE_ROOT, "manifest.csv"),
    toCsv(MANIFEST_HEADERS, manifestRows),
  );
  await writeSummary(records, manifestRows);

  const ok = manifestRows.filter((row) => row.status === "ok").length;
  console.log(`Fetched ${records.length} placeable items; downloaded ${ok} icons.`);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "pokopia-color-pattern-data-fetcher/1.0 (+https://pokopiadex.com/items)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractAllItems(html) {
  const pushes = [];
  const scriptPattern = /<script>(self\.__next_f\.push\([\s\S]*?\))<\/script>/g;
  let match;

  while ((match = scriptPattern.exec(html))) {
    vm.runInNewContext(match[1], {
      self: {
        __next_f: {
          push(value) {
            pushes.push(value);
          },
        },
      },
    });
  }

  const flightText = pushes
    .map((push) => (typeof push[1] === "string" ? push[1] : ""))
    .join("");
  const itemsJson = extractJsonArrayAfter(flightText, "\"allItems\"");
  return JSON.parse(itemsJson);
}

function extractJsonArrayAfter(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Cannot find ${marker} in PokopiaDex flight data`);
  }

  const start = text.indexOf("[", markerIndex + marker.length);
  if (start === -1) {
    throw new Error(`Cannot find array after ${marker}`);
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Cannot find array end after ${marker}`);
}

function toRecord(item) {
  const { key, value } = findOrder(item);

  return {
    kind: "placeable_item",
    id: item.id ?? "",
    name: item.name ?? "",
    slug: item.slug ?? slugify(item.name),
    description: item.preferred_description || item.description || item.custom_description || "",
    category: item.menu_category ?? "",
    tags: JSON.stringify(item.tags ?? []),
    sources: JSON.stringify(item.sources ?? []),
    event: item.event ?? "",
    inventory_status: item.inventory_status ?? "",
    collectible: item.collectible ?? "",
    order_key: key,
    order_value: value,
    trade_sell_value: item.trade_sell_value ?? "",
    trade_buy_value: item.trade_buy_value ?? "",
    trade_buy_quantity: item.trade_buy_quantity ?? "",
    life_coins: item.life_coins ?? "",
    shop_level: item.shop_level ?? "",
    mosslax: item.mosslax ?? "",
    storage_capacity: item.storage_capacity ?? "",
    habitat_item_category_ids: JSON.stringify(item.habitat_item_category_ids ?? []),
    favorite_category_ids: JSON.stringify(item.favorite_category_ids ?? []),
    image_url: absoluteUrl(item.imageSrc),
    variant_image_urls: JSON.stringify((item.variantSrcs ?? []).map(absoluteUrl)),
    source_page: `${SOURCE_ORIGIN}/items/${item.slug}`,
    source: "pokopiadex_items_in_collection",
  };
}

function findOrder(item) {
  const orderEntry = Object.entries(item).find(
    ([key, value]) => key.endsWith("_order") && value !== null && value !== undefined,
  );

  return {
    key: orderEntry?.[0] ?? "",
    value: orderEntry?.[1] ?? "",
  };
}

async function downloadImage(url, filenameBase) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "pokopia-color-pattern-data-fetcher/1.0",
    },
  });

  if (!response.ok) {
    return {
      filename: `${filenameBase}.bin`,
      contentType: "",
      bytes: "",
      sha256: "",
      status: "error",
      error: `${response.status} ${response.statusText}`,
    };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  const filename = `${filenameBase}.${extensionFor(contentType, url)}`;

  await writeFile(path.join(IMAGE_ROOT, filename), bytes);

  return {
    filename,
    contentType,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    status: "ok",
    error: "",
  };
}

function extensionFor(contentType, url) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg") return "jpg";

  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
  return ext || "bin";
}

function absoluteUrl(value) {
  return new URL(value, SOURCE_ORIGIN).href;
}

function toCsv(headers, rows) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

async function writeSummary(records, manifestRows) {
  const categoryCounts = countBy(records, (record) => record.category || "Uncategorized");
  const tagCounts = countBy(
    records.flatMap((record) => JSON.parse(record.tags)),
    (tag) => tag,
  );
  const okCount = manifestRows.filter((row) => row.status === "ok").length;

  const summary = [
    "# PokopiaDex placeable item scrape",
    "",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Source page: ${SOURCE_PAGE}`,
    "",
    "## Counts",
    `- Placeable/in-collection item rows: ${records.length}`,
    `- Downloaded icons: ${okCount}`,
    `- Failed icons: ${manifestRows.length - okCount}`,
    "",
    "## Output files",
    "- `pokopiadex_placeable_items.csv`: one row per PokopiaDex in-collection item with normalized meta columns.",
    "- `pokopiadex_placeable_items.json`: raw PokopiaDex item objects after the in-collection filter.",
    "- `item_portraits/`: local icon files for the complete in-collection item set.",
    "- `item_portraits/manifest.csv`: normalized meta plus local filename, byte size, SHA-256, and download status.",
    "",
    "## Category counts",
    ...Object.entries(categoryCounts).map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Tag counts",
    ...Object.entries(tagCounts).map(([key, count]) => `- ${key}: ${count}`),
    "",
  ];

  await writeFile(path.join(OUTPUT_ROOT, "pokopiadex_placeable_items_summary.md"), summary.join("\n"));
}

function countBy(values, keyFn) {
  return values.reduce((acc, value) => {
    const key = keyFn(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
