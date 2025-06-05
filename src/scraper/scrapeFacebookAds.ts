import { chromium } from "playwright";
import crypto from "crypto";

export interface ScrapeInput {
  company?: string;
  start_date?: string;
  end_date?: string;
  keywords?: string[];
}

export async function scrapeFacebookAds({ company }: ScrapeInput) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("https://www.facebook.com/ads/library/", {
      waitUntil: "domcontentloaded",
    });

    await page.waitForTimeout(5000);

    // Accept cookies
    try {
      const acceptBtn = page.getByText("Allow all cookies", { exact: true });
      if (await acceptBtn.isVisible()) {
        console.log("✅ Clicking Allow Cookies...");
        await acceptBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch {
      console.log("⚠️ 'Allow all cookies' button not found or not visible.");
    }

    // Click Ad category
    const adCategoryButton = page.getByText("Ad category", { exact: true });
    await adCategoryButton.waitFor({ timeout: 10000 });
    console.log("🔽 Clicking 'Ad category' dropdown...");
    await adCategoryButton.click();
    await page.waitForTimeout(1000);

    // Select "All ads"
    console.log("✅ Looking for 'All ads' option...");
    const allAdsOption = page.getByText("All ads", { exact: true });
    if (!(await allAdsOption.isVisible())) {
      throw new Error("❌ Could not find a visible 'All ads' option to click.");
    }

    await allAdsOption.click();
    console.log("✅ 'All ads' selected.");
    await page.waitForTimeout(2000);

    // Find search input
    console.log("🔍 Waiting for search input to appear...");
    const inputs = await page.$$("input");
    let searchInput = null;

    for (const input of inputs) {
      const isVisible = (await input.boundingBox()) !== null;
      const placeholder = await input.getAttribute("placeholder");

      if (
        isVisible &&
        placeholder &&
        !placeholder.toLowerCase().includes("category")
      ) {
        searchInput = input;
        console.log(`✅ Fallback input found: placeholder="${placeholder}"`);
        break;
      }
    }

    if (!searchInput) {
      throw new Error("❌ Could not find a usable search input.");
    }

    await searchInput.click();
    await page.keyboard.type(company || "", { delay: 100 });
    await page.keyboard.press("Enter");

    console.log("⏳ Waiting for ads or 'no results' message...");
    const resultsOrEmpty = await Promise.race([
      page
        .waitForSelector("text=Library ID", {
          timeout: 15000,
          state: "attached",
        })
        .then(() => "ads"),
      page
        .waitForSelector("text=No results found", {
          timeout: 15000,
          state: "attached",
        })
        .then(() => "none"),
    ]);

    if (resultsOrEmpty === "none") {
      console.log("⚠️ No ads found for this query.");
      return [];
    }

    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(2000);

    const adSpans = await page.locator("text=Library ID").elementHandles();
    console.log(`🔍 Found ${adSpans.length} ad(s)`);

    const ads = [];

    for (const span of adSpans) {
      const ad = await span.evaluateHandle((node) => {
        let container = node;
        for (let i = 0; i < 5; i++) {
          if (container.parentElement) container = container.parentElement;
        }
        return container;
      });

      const rawText = await ad.evaluate((el) => el.textContent || "");

      const advertiser = await ad.evaluate((node) => {
        const el = node as HTMLElement;
        const nameEl = el.querySelector("strong") || el.querySelector('[role="heading"]');
        return nameEl?.textContent?.trim() || "";
      });

      const startDateMatch = rawText.match(/Started running on (.+?) ·/);
      const endDateMatch = rawText.match(/Ended on (.+?)(?: ·|$)/);
      const impressionsMatch = rawText.match(/Impressions:\s*([<\d,]+(?:K|M)?)/);
      const spendMatch = rawText.match(/Amount spent.*?:\s*(.+?)(?:Impressions|$)/);

      const creativeUrl = await ad.evaluate((node) => {
        const el = node as HTMLElement;
        const img = el.querySelector("img");
        if (img?.src) return img.src;

        const bg = el.querySelector('[style*="background-image"]');
        const style = bg?.getAttribute("style") || "";
        const match = style.match(/url\("?([^")]+)"?\)/);
        return match?.[1] || null;
      });

      const targeting = await ad.evaluate((node) => {
        const el = node as HTMLElement;
        const lines = Array.from(el.querySelectorAll("span, div")).map((e) => e.textContent || "");
        return lines.find((line) => line.includes("People who may see this ad")) || "";
      });

      ads.push({
        id: crypto.randomUUID(),
        advertiser,
        content: rawText.trim(),
        start_date: startDateMatch?.[1]?.trim() || null,
        end_date: endDateMatch?.[1]?.trim() || null,
        impressions: impressionsMatch?.[1]?.trim() || null,
        spend: spendMatch?.[1]?.trim() || null,
        platforms: ["Facebook"],
        creative_url: creativeUrl,
        demographics: targeting ? { targeting } : {},
        scraped_at: new Date().toISOString(),
      });
    }

    return ads;
  } catch (err) {
    console.error("❌ Scraping failed:", err);
    return [];
  } finally {
    await browser.close();
  }
}
