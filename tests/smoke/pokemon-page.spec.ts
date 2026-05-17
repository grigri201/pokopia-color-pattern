import { readFileSync } from "node:fs";
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
  await expect(page.locator("#metricStrip")).toContainText("HEX");
  await expect(page.locator("#swatchList")).toContainText("#DCBFFF");
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
  await expect(page.locator("#fullscreenMeta")).toHaveText("No. 077 / #eevee");
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
  await page.route("http://127.0.0.1:4173/data/recommendations/ditto.json", async (route) => {
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
