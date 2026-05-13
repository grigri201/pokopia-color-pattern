import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type CompactItem = {
  slug: string;
  name: string;
  nameZh: string | null;
  imagePath: string;
  category: string | null;
  recommendation: {
    isDyeable: boolean | null;
    itemPrimaryColor: string | null;
  };
};

type CompactItemsData = {
  items: CompactItem[];
};

test("direct Pokemon static page hydrates against real dist data", async ({ page }) => {
  const staticResponse = await page.request.get("/pokemon/ditto/");
  expect(staticResponse.ok()).toBeTruthy();
  const staticHtml = await staticResponse.text();
  expect(staticHtml).toContain('id="staticPage"');
  expect(staticHtml).toContain('data-static-pokemon="ditto"');
  expect(staticHtml).toContain("百变怪 / Ditto");
  expect(staticHtml).toContain("063-ditto.png");
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

  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#staticPage")).toHaveCount(0);
  await expect(page.locator("#hashLabel")).toHaveText("#ditto");
  await expect(page.locator("#pokemonTitle")).toContainText("Ditto");
  await expect(page.locator("#selectedPortrait")).toHaveAttribute("src", /063-ditto\.png/);
  await expect(page.locator("#metricStrip")).toContainText("HEX");
  await expect(page.locator("#swatchList")).toContainText("#DCBFFF");
  await expect(page.locator("#furnitureGrid")).toContainText("当前数据和规则暂未产生推荐搭配");
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
  await expect(page.locator("#hashLabel")).toHaveText("#ditto");
  await expect(page.locator("#pokemonTitle")).toContainText("Ditto");
  await expect(page.locator("#selectedPortrait")).toHaveAttribute("src", /063-ditto\.png/);
  await expect(page.locator("#metricStrip")).toContainText("HEX");
  await expect(page.locator("#swatchList")).toContainText("#");

  expect(interceptedFixture).toBe(true);
  await expect(page.locator(".recommendation-summary")).toContainText("1-10 / 12");
  await expect(page.locator(".recommendation-card")).toHaveCount(10);
  await page.getByRole("button", { name: "下一页推荐搭配" }).click();
  await expect(page.locator(".recommendation-summary")).toContainText("11-12 / 12");
  await expect(page.locator(".recommendation-card")).toHaveCount(2);
  await page.getByRole("button", { name: "上一页推荐搭配" }).click();
  await expect(page.locator(".recommendation-summary")).toContainText("1-10 / 12");

  await page.locator("#itemFilter").selectOption("家具");
  await expect(page.locator("#itemSectionTitle")).toHaveText("推荐搭配 · 家具");
  await expect(page.locator(".recommendation-summary")).toContainText("1-2 / 2");
  await expect(page.locator(".recommendation-card")).toHaveCount(2);
  await page.locator("#itemFilter").selectOption("全部");
  await expect(page.locator("#itemSectionTitle")).toHaveText("推荐搭配 · 全部");
  await expect(page.locator(".recommendation-summary")).toContainText("1-10 / 12");

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
  await expect(page.locator("#hashLabel")).toHaveText("#eevee");
  await expect(page.locator("#pokemonTitle")).toContainText("Eevee");
  await expect(page.locator("#furnitureGrid")).toContainText("当前数据和规则暂未产生推荐搭配");
});

function buildRecommendationFixture(pokemonSlug: string): unknown {
  const data = JSON.parse(readFileSync("dist/data/compact-items.json", "utf8")) as CompactItemsData;
  const foodItems = data.items.filter((item) => item.category === "Food").slice(0, 10);
  const furnitureItems = data.items.filter((item) => item.category === "Furniture").slice(0, 2);
  const items = [...foodItems, ...furnitureItems];
  return {
    schemaVersion: "recommendations.v2",
    pokemonSlug,
    pageSize: 10,
    totalPages: 2,
    recommendations: items.map((item, index) => ({
      itemSlug: item.slug,
      itemName: item.name,
      itemZhName: item.nameZh,
      itemImagePath: item.imagePath,
      category: item.category,
      matchedPreferenceTerms: ["smoke"],
      isDyeable: item.recommendation.isDyeable ?? false,
      pokemonPrimaryColor: "#DCBFFF",
      itemPrimaryColor: item.recommendation.itemPrimaryColor,
      harmonyStatus: "not_required",
      harmonyType: null,
      overrideSource: null,
      rank: index + 1,
      pageIndex: Math.floor(index / 10),
    })),
  };
}
