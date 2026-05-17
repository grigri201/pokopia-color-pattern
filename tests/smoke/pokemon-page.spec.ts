import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type CompactItem = {
  slug: string;
  name: string;
  nameZh: string | null;
  imagePath: string;
  category: string | null;
  recommendation: {
    isDyeable: boolean | null;
    dyeColorVariants: string[];
    itemPrimaryColor: string | null;
  };
};

type CompactItemsData = {
  items: CompactItem[];
};

type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

test.use({ locale: "zh-CN" });

test("direct Pokemon static page hydrates against real dist data", async ({ page }) => {
  const staticResponse = await page.request.get("/pokemon/ditto/");
  expect(staticResponse.ok()).toBeTruthy();
  const staticHtml = await staticResponse.text();
  expect(staticHtml).toContain('id="staticPage"');
  expect(staticHtml).toContain('data-static-pokemon="ditto"');
  expect(staticHtml).toContain("百变怪 / Ditto");
  expect(staticHtml).toContain("/assets/runtime/pokemon/ditto.webp");
  expect(staticHtml).toContain("#DCBFFF");
  expect(staticHtml).toContain("推荐摘要");

  const recommendationResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/data/recommendations/ditto.json";
  });
  await page.goto("/pokemon/ditto/");
  const recommendationResponse = await recommendationResponsePromise;
  expect(recommendationResponse.status()).toBe(200);
  const recommendationData = (await recommendationResponse.json()) as { pokemonSlug: string; recommendations: unknown[] };
  expect(recommendationData.pokemonSlug).toBe("ditto");
  expect(Array.isArray(recommendationData.recommendations)).toBe(true);
  expect(recommendationData.recommendations.length).toBeGreaterThan(0);
  const firstRecommendation = recommendationData.recommendations[0] as Record<string, unknown>;
  expect(Object.keys(firstRecommendation)).not.toEqual(expect.arrayContaining(["itemName", "itemImagePath", "category", "pokemonPrimaryColor"]));

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#staticPage")).toHaveCount(0);
  await expect(page.locator("#languageToggle")).toHaveText("English");
  const githubLink = page.getByRole("link", { name: "GitHub repository" });
  await expect(githubLink).toHaveAttribute(
    "href",
    "https://github.com/grigri201/pokopia-color-pattern",
  );
  await expect(githubLink).toHaveText("");
  await expect(githubLink.locator("svg")).toBeVisible();
  await expect(page.locator("#pokemonTitle")).toContainText("Ditto");
  await expect(page.locator("#selectedPortrait")).toHaveAttribute("src", /\/assets\/runtime\/pokemon\/ditto\.webp/);
  await expect(page.locator("#floatPortrait")).toHaveCount(0);
  await expect(page.locator("#drawerTrigger img")).toHaveCount(0);
  await expect(page.locator("#metricStrip")).toContainText("HEX");
  await expect(page.locator("#swatchList")).toContainText("#DCBFFF");
  const paletteAnalysis = await boundingBox(page, ".analysis-card:nth-of-type(1)");
  const patternAnalysis = await boundingBox(page, ".analysis-card:nth-of-type(2)");
  expect(Math.abs(paletteAnalysis.height - patternAnalysis.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(paletteAnalysis.bottom - patternAnalysis.bottom)).toBeLessThanOrEqual(1);
  await expect(page.locator(".recommendation-summary")).toContainText("/");
  await expect(page.locator(".recommendation-card").first()).toBeVisible();
  await expect(page.locator(".recommendation-card img").first()).toHaveAttribute("src", /\/assets\/runtime\/items\/.*\.webp/);
});

test("fullscreen overlay opens from current Pokemon and exits without route changes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new Error("native fullscreen unavailable in test")),
    });
  });
  await page.goto("/pokemon/eevee/");
  await expect(page.locator("#app")).toBeVisible();
  const initialUrl = page.url();
  const initialHistoryLength = await page.evaluate(() => history.length);
  const entry = page.getByRole("button", { name: "打开全屏展示" });

  await entry.click();
  await expect(page.locator("#fullscreenOverlay")).toBeVisible();
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("data-selected-slug", "eevee");
  await expect(page.locator("#fullscreenBrand")).toHaveText("Pokopia 装饰图鉴");
  await expect(page.locator("#fullscreenLanguageToggle")).toHaveText("English");
  await expect(page.locator("#fullscreenMeta")).toHaveText("No. 280 / #eevee");
  await expect(page.locator("#fullscreenTitle")).toHaveText("伊布");
  await expect(page.locator("#app")).toHaveJSProperty("inert", true);
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  await page.locator("#fullscreenClose").evaluate((button) => (button as HTMLButtonElement).blur());
  await page.keyboard.press("Tab");
  await expect(page.locator("#fullscreenLanguageToggle")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#fullscreenLanguageToggle")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);

  await page.keyboard.press("Escape");
  await expect(page.locator("#fullscreenOverlay")).toBeHidden();
  await expect(page.locator("#app")).toHaveJSProperty("inert", false);
  await expect(entry).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);

  await entry.click();
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  await page.locator("#fullscreenClose").click();
  await expect(page.locator("#fullscreenOverlay")).toBeHidden();
  await expect(entry).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);

  await entry.click();
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  await page.evaluate(() => {
    location.hash = "#definitely-missing";
  });
  await expect(page.locator("#fullscreenOverlay")).toBeHidden();
  await expect(entry).toBeFocused();
});

test("F11 browser fullscreen intent opens the app fullscreen overlay", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/pokemon/eevee/");
  await expect(page.locator("#app")).toBeVisible();
  const initialUrl = page.url();
  const initialHistoryLength = await page.evaluate(() => history.length);

  await page.keyboard.press("F11");

  await expect(page.locator("#fullscreenOverlay")).toBeVisible();
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("data-selected-slug", "eevee");
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);

  await page.keyboard.press("Escape");
  await expect(page.locator("#fullscreenOverlay")).toBeHidden();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);
});

test("Chrome presentation shortcut opens the app fullscreen overlay", async ({ page }) => {
  await page.goto("/pokemon/eevee/");
  await expect(page.locator("#app")).toBeVisible();
  const initialUrl = page.url();
  const initialHistoryLength = await page.evaluate(() => history.length);

  await page.keyboard.press("Meta+Shift+F");

  await expect(page.locator("#fullscreenOverlay")).toBeVisible();
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("data-selected-slug", "eevee");
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);
});

test("fullscreen overlay renders identity, color, palette, pattern, and preferences", async ({ page }) => {
  await page.goto("/pokemon/eevee/");
  await expect(page.locator("#app")).toBeVisible();
  const mainPatternColors = await page.locator("#patternView .pattern-cell").evaluateAll((cells) =>
    cells.map((cell) => getComputedStyle(cell).backgroundColor),
  );
  await page.getByRole("button", { name: "打开全屏展示" }).click();

  await expect(page.locator("#fullscreenMeta")).toHaveText("No. 280 / #eevee");
  await expect(page.locator("#fullscreenTitle")).toHaveText("伊布");
  await expect(page.locator("#fullscreenPortrait")).toHaveAttribute("src", /\/assets\/runtime\/pokemon\/eevee\.webp/);
  await expect(page.locator("#fullscreenPortrait")).toHaveAttribute("alt", "伊布 Eevee");
  await expect(page.locator("#fullscreenPortraitNumber")).toHaveText("280");
  await expect(page.locator("#fullscreenPrimaryValues")).toContainText("HEX");
  await expect(page.locator("#fullscreenPrimaryValues")).toContainText("#EFA849");
  await expect(page.locator("#fullscreenPrimaryValues")).toContainText("RGB");
  await expect(page.locator("#fullscreenPrimaryValues")).toContainText("239, 168, 73");
  await expect(page.locator("#fullscreenPrimaryValues")).toContainText("CMYK");
  await expect(page.locator("#fullscreenPrimaryValues")).toContainText("0, 30, 69, 6");
  await expect(page.locator("#fullscreenPaletteTitle")).toHaveText("色板");
  await expect(page.locator("#fullscreenPalette .fullscreen-swatch")).toHaveCount(6);
  await expect(page.locator("#fullscreenPalette .fullscreen-swatch").first()).toContainText("#EFA849 / 19.8%");
  await expect(page.locator("#fullscreenPatternTitle")).toHaveText("图案");
  await expect(page.locator("#fullscreenPattern span")).toHaveCount(40);
  const fullscreenPatternColors = await page.locator("#fullscreenPattern span").evaluateAll((cells) =>
    cells.map((cell) => getComputedStyle(cell).backgroundColor),
  );
  expect(fullscreenPatternColors).toEqual(mainPatternColors);
  await expect(page.locator("#fullscreenPreferencesTitle")).toHaveText("偏好档案");
  await expect(page.locator("#fullscreenPreferences")).toContainText("可爱物品");
  await expect(page.locator("#fullscreenPreferences")).toContainText("集体活动");

  await page.goto("/pokemon/ditto/");
  await page.getByRole("button", { name: "打开全屏展示" }).click();
  await expect(page.locator("#fullscreenPreferencesTitle")).toHaveText("偏好档案");
  await expect(page.locator("#fullscreenPreferences .fullscreen-empty")).toHaveText("暂无偏好词");
});

test("fullscreen overlay matches Open Design responsive samples and runtime boundary", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/pokemon/riolu/");
  const initialUrl = page.url();
  const initialHash = await page.evaluate(() => location.hash);
  const initialHistoryLength = await page.evaluate(() => history.length);
  const entry = page.getByRole("button", { name: "打开全屏展示" });
  await page.getByRole("button", { name: "打开全屏展示" }).click();

  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("data-selected-slug", "riolu");
  await expect(page.locator("#fullscreenMeta")).toHaveText("No. 180 / #riolu");
  await expect(page.locator("[data-od-id='fullscreen-layout']")).toBeVisible();
  await expect(page.locator("[data-od-id='fullscreen-toolbar']")).toBeVisible();
  await expect(page.locator("[data-od-id='fullscreen-content']")).toBeVisible();
  await expect(page.locator("[data-od-id='fullscreen-info']")).toBeVisible();
  await expect(page.locator("[data-od-id='fullscreen-identity']")).toContainText("利欧路");
  await expect(page.locator("[data-od-id='fullscreen-color-stack']")).toContainText("#61BEF4");
  await expect(page.locator("[data-od-id='fullscreen-palette'] .fullscreen-swatch")).toHaveCount(6);
  await expect(page.locator("[data-od-id='fullscreen-pattern']")).toBeVisible();
  await expect(page.locator("[data-od-id='fullscreen-pattern'] span")).toHaveCount(40);
  await expect(page.locator("[data-od-id='fullscreen-preferences']")).toContainText("建造");
  await expect(page.locator("[data-od-id='fullscreen-preferences']")).toContainText("观赏物品");
  await expect(page.locator("[data-od-id='fullscreen-pokemon-card'] img")).toHaveAttribute("src", /\/assets\/runtime\/pokemon\/riolu\.webp/);
  await expect(page.locator("[data-od-id='fullscreen-pokemon-card'] img")).not.toHaveAttribute("src", /\/docs\/pokopia_image_sources\//);
  const sources = await fullscreenAssetSources(page);
  expect(sources).toEqual(expect.arrayContaining(["/assets/runtime/pokemon/riolu.webp"]));
  expect(sources.every((src) => src.startsWith("/assets/runtime/"))).toBe(true);
  expect(readFileSync(join("dist", "index.html"), "utf8")).not.toContain("/docs/pokopia_image_sources");
  const builtAssets = readFileSync(join("dist", "assets", builtAssetName("css")), "utf8")
    + readFileSync(join("dist", "assets", builtAssetName("js")), "utf8");
  expect(builtAssets).not.toContain("/docs/pokopia_image_sources");
  expect((await page.locator("#fullscreenOverlay").innerText()).toLowerCase()).not.toMatch(/壁纸|导出|下载|wallpaper|export|download/);
  await expect(page.getByRole("button", { name: /壁纸|导出|下载|wallpaper|export|download/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /壁纸|导出|下载|wallpaper|export|download/i })).toHaveCount(0);
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => location.hash)).toBe(initialHash);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);

  let identity = await boundingBox(page, "[data-od-id='fullscreen-identity']");
  let colorStack = await boundingBox(page, "[data-od-id='fullscreen-color-stack']");
  let preferences = await boundingBox(page, "[data-od-id='fullscreen-preferences']");
  let info = await boundingBox(page, "[data-od-id='fullscreen-info']");
  let card = await boundingBox(page, "[data-od-id='fullscreen-pokemon-card']");
  expect(info.width * info.height).toBeGreaterThan(0);
  expect(card.width * card.height).toBeGreaterThan(0);
  expect(info.right).toBeLessThanOrEqual(card.left + 8);
  expect(identity.bottom).toBeLessThanOrEqual(colorStack.top + 8);
  expect(colorStack.right).toBeLessThanOrEqual(preferences.left + 8);
  await assertBoxesStayInside(page, "[data-od-id='fullscreen-preferences'] .fullscreen-terms span", "[data-od-id='fullscreen-preferences']");

  await page.setViewportSize({ width: 1000, height: 820 });
  await page.reload();
  await page.getByRole("button", { name: "打开全屏展示" }).click();
  identity = await boundingBox(page, "[data-od-id='fullscreen-identity']");
  colorStack = await boundingBox(page, "[data-od-id='fullscreen-color-stack']");
  preferences = await boundingBox(page, "[data-od-id='fullscreen-preferences']");
  info = await boundingBox(page, "[data-od-id='fullscreen-info']");
  card = await boundingBox(page, "[data-od-id='fullscreen-pokemon-card']");
  expect(info.width * info.height).toBeGreaterThan(0);
  expect(card.width * card.height).toBeGreaterThan(0);
  expect(info.bottom).toBeLessThanOrEqual(card.top + 8);
  expect(identity.bottom).toBeLessThanOrEqual(colorStack.top + 8);
  expect(colorStack.bottom).toBeLessThanOrEqual(preferences.top + 8);

  await page.goto("/pokemon/ditto/");
  await page.getByRole("button", { name: "打开全屏展示" }).click();
  await expect(page.locator("#fullscreenPreferences .fullscreen-empty")).toBeVisible();
  const empty = await boundingBox(page, "#fullscreenPreferences .fullscreen-empty");
  expect(empty.height).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pokemon/pikachu/");
  await page.getByRole("button", { name: "打开全屏展示" }).click();
  await expect(page.locator("#fullscreenOverlay")).toHaveAttribute("data-selected-slug", "pikachu");
  await expect(page.locator("#fullscreenPortrait")).toHaveAttribute("src", /\/assets\/runtime\/pokemon\/pikachu\.webp/);
  await expect(page.locator("#fullscreenLanguageToggle")).toBeVisible();
  await expect(page.locator("#fullscreenClose")).toBeVisible();
  const title = await boundingBox(page, "#fullscreenTitle");
  const image = await boundingBox(page, "#fullscreenPortrait");
  expect(title.width * title.height).toBeGreaterThan(0);
  expect(image.width * image.height).toBeGreaterThan(0);
  expect(title.bottom).toBeLessThanOrEqual(image.top + 8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.locator("#fullscreenOverlay").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator("#fullscreenLanguageToggle")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#fullscreenPaletteTitle")).toHaveText("Swatches");
  await page.keyboard.press("Tab");
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#fullscreenOverlay")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open fullscreen view" })).toBeFocused();
  await page.getByRole("button", { name: "Open fullscreen view" }).click();
  await expect(page.locator("#fullscreenClose")).toBeFocused();
  await page.locator("#fullscreenClose").click();
  await expect(page.locator("#fullscreenOverlay")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open fullscreen view" })).toBeFocused();
});

test.describe("English browser locale", () => {
  test.use({ locale: "en-US" });

  test("uses English by default and keeps visible UI free of Chinese text", async ({ page }) => {
    await page.goto("/pokemon/ditto/");

    await expect(page.locator("#app")).toBeVisible();
    await expect(page.locator("#staticPage")).toHaveCount(0);
    await expect(page.locator("#languageToggle")).toHaveText("Chinese");
    await expect(page.locator("#pokemonTitle")).toHaveText("Ditto");
    await expect(page.locator("#selectedPortrait")).toHaveAttribute("alt", "Ditto");
    await expect(page.locator("#floatName")).toHaveText("Ditto");
    await expect(page.locator("#paletteTitle")).toHaveText("Swatches");
    await expect(page.locator("#panelTitle")).toHaveText("Item Match");
    await expect(page.locator("#itemSectionTitle")).toHaveText("Recommendations · All");
    await expect(page.locator(".recommendation-card").first()).toContainText("Matched terms");

    const recommendationNames = await page.locator(".recommendation-card h3").allTextContents();
    recommendationNames.forEach((name) => expect(name).not.toMatch(/[\u3400-\u9fff]/));

    await page.locator("#drawerTrigger").click();
    const dittoButton = page.locator("#pokemonList [data-slug='ditto']");
    await expect(dittoButton).toHaveAttribute("aria-label", "Ditto");
    await expect(dittoButton.locator("strong")).toHaveText("Ditto");

    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toMatch(/[\u3400-\u9fff]/);
  });
});

test("legacy hash route canonicalizes to Pokemon pathname", async ({ page }) => {
  await page.goto("/#abra");

  await expect(page).toHaveURL(/\/pokemon\/abra\/$/);
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#pokemonTitle")).toContainText("Abra");
  await expect(page.locator("#languageToggle")).toHaveText("English");
});

test("food filter empty state keeps only show all action", async ({ page }) => {
  await page.goto("/pokemon/drifloon/");

  await page.locator("#itemFilter").selectOption("食物");
  await expect(page.locator("#itemSectionTitle")).toHaveText("推荐搭配 · 食物");
  await expect(page.locator(".recommendation-state")).toContainText("当前筛选下没有推荐搭配");
  await expect(page.locator('[data-recommendation-action="reset-filter"]')).toHaveCount(1);
  await expect(page.locator('[data-recommendation-action="switch-pokemon"]')).toHaveCount(0);
});

test("hydrated Pokemon page keeps pagination, filters, search, and switching usable", async ({ page }) => {
  let interceptedFixture = false;
  await page.route("**/data/recommendations/ditto.json", async (route) => {
    interceptedFixture = true;
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(buildRecommendationFixture("ditto")),
    });
  });

  await page.goto("/pokemon/ditto/");

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#staticPage")).toHaveCount(0);
  await expect(page.locator("#languageToggle")).toHaveText("English");
  await expect(page.locator("#pokemonTitle")).toContainText("Ditto");
  await expect(page.locator("#selectedPortrait")).toHaveAttribute("src", /\/assets\/runtime\/pokemon\/ditto\.webp/);
  await expect(page.locator("#metricStrip")).toContainText("HEX");
  await expect(page.locator("#swatchList")).toContainText("#");

  expect(interceptedFixture).toBe(true);
  await expect(page.locator(".recommendation-summary")).toContainText("1-10 / 12");
  await expect(page.locator(".recommendation-card")).toHaveCount(10);
  await expectVisibleRecommendationNamesToExcludeSeeds(page);
  await page.getByRole("button", { name: "下一页推荐搭配" }).click();
  await expect(page.locator(".recommendation-summary")).toContainText("11-12 / 12");
  await expect(page.locator(".recommendation-card")).toHaveCount(2);
  await expectVisibleRecommendationNamesToExcludeSeeds(page);
  await page.getByRole("button", { name: "上一页推荐搭配" }).click();
  await expect(page.locator(".recommendation-summary")).toContainText("1-10 / 12");

  await page.locator("#itemFilter").selectOption("家具");
  await expect(page.locator("#itemSectionTitle")).toHaveText("推荐搭配 · 家具");
  await expect(page.locator(".recommendation-summary")).toContainText("1-2 / 2");
  await expect(page.locator(".recommendation-card")).toHaveCount(2);
  await page.locator("#itemFilter").selectOption("地块");
  await expect(page.locator(".recommendation-state")).toContainText("当前筛选下没有推荐搭配");
  await expect(page.locator('[data-recommendation-action="reset-filter"]')).toHaveCount(1);
  await expect(page.locator('[data-recommendation-action="switch-pokemon"]')).toHaveCount(0);
  await page.locator("#itemFilter").selectOption("全部");
  await expect(page.locator("#itemSectionTitle")).toHaveText("推荐搭配 · 全部");
  await expect(page.locator(".recommendation-summary")).toContainText("1-10 / 12");
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.locator("#paletteTitle")).toHaveText("Swatches");
  await expect(page.locator("#panelTitle")).toHaveText("Item Match");
  await expect(page.locator("#itemSectionTitle")).toHaveText("Recommendations · All");
  await expect(page.locator("#itemFilter")).toContainText("All");
  await expect(page.locator(".recommendation-card").first()).toContainText("Matched terms");
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.locator("#paletteTitle")).toHaveText("色板");
  await expect(page.locator("#panelTitle")).toHaveText("搭配道具");

  await page.locator("#drawerTrigger").click();
  await expect(page.locator("#pokemonDrawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#resultCount")).toHaveText("311");
  await page.locator("#searchInput").fill("eevee");
  await expect(page.locator("#resultCount")).toHaveText("001");
  await expect(page.locator("#pokemonList [data-slug]")).toHaveCount(1);
  const eeveeButton = page.locator("#pokemonList [data-slug='eevee']");
  await expect(eeveeButton).toBeVisible();
  await eeveeButton.click();

  await expect(page).toHaveURL(/\/pokemon\/eevee\/$/);
  await expect(page.locator("#pokemonTitle")).toContainText("Eevee");
  await expect(page.locator(".recommendation-summary")).toContainText("/");
  await expect(page.locator(".recommendation-card").first()).toBeVisible();
});

function buildRecommendationFixture(pokemonSlug: string): unknown {
  const data = JSON.parse(readFileSync("dist/data/compact-items.json", "utf8")) as CompactItemsData;
  const seedItem = data.items.find((item) => item.nameZh?.endsWith("种子") || /(?:^|[-\s])seeds?$/i.test(item.name));
  const foodItems = data.items.filter((item) => item.category === "Food").slice(0, 10);
  const furnitureItems = data.items.filter((item) => item.category === "Furniture").slice(0, 2);
  const items = [seedItem, ...foodItems, ...furnitureItems].filter((item): item is CompactItem => Boolean(item));
  return {
    schemaVersion: "recommendations.v4",
    pokemonSlug,
    pageSize: 10,
    totalPages: 2,
    recommendations: items.map((item, index) => ({
      itemSlug: item.slug,
      matchedPreferenceTerms: ["smoke"],
      harmonyStatus: "not_required",
      harmonyType: null,
      recommendedDyeColors: item.recommendation.isDyeable ? item.recommendation.dyeColorVariants.slice(0, 2) : [],
      overrideSource: null,
      rank: index + 1,
      pageIndex: Math.floor(index / 10),
    })),
  };
}

async function expectVisibleRecommendationNamesToExcludeSeeds(page: Page): Promise<void> {
  const names = await page.locator(".recommendation-card h3").allTextContents();
  names.forEach((name) => expect(name).not.toMatch(/种子|seed/i));
}

async function boundingBox(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function fullscreenAssetSources(page: Page): Promise<string[]> {
  return page.locator("#fullscreenOverlay [src]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("src") ?? ""),
  );
}

async function assertBoxesStayInside(page: Page, childSelector: string, parentSelector: string): Promise<void> {
  const parent = await boundingBox(page, parentSelector);
  const children = await page.locator(childSelector).evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    }),
  );

  expect(children.length).toBeGreaterThan(0);
  children.forEach((child) => {
    expect(child.width * child.height).toBeGreaterThan(0);
    expect(child.left).toBeGreaterThanOrEqual(parent.left - 8);
    expect(child.right).toBeLessThanOrEqual(parent.right + 8);
  });
}

function builtAssetName(extension: "css" | "js"): string {
  const indexHtml = readFileSync(join("dist", "index.html"), "utf8");
  const pattern = new RegExp(`/assets/([^"]+\\.${extension})`);
  const match = indexHtml.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Unable to find built ${extension} asset in dist/index.html`);
  }
  return match[1];
}
