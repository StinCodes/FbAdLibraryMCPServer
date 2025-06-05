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

    await page.waitForTimeout(5000); // let page fully render

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

    // Click the Ad Category dropdown
    const adCategoryButton = page.getByText("Ad category", { exact: true });
    await adCategoryButton.waitFor({ timeout: 10000 });
    console.log("🔽 Clicking 'Ad category' dropdown...");
    await adCategoryButton.click();
    await page.waitForTimeout(1000);

    // Select "All ads" option
    console.log("✅ Looking for 'All ads' option...");
    const allAdsOption = page.getByText("All ads", { exact: true });

    const isAllAdsVisible = await allAdsOption.isVisible();
    if (!isAllAdsVisible) {
      throw new Error("❌ Could not find a visible 'All ads' option to click.");
    }

    await allAdsOption.click();
    console.log("✅ 'All ads' selected.");
    await page.waitForTimeout(2000);

    // Wait for search input field
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
      console.log("⚠️ Logging all visible inputs for debugging:");
      for (const input of inputs) {
        const placeholder = await input.getAttribute("placeholder");
        const isVisible = (await input.boundingBox()) !== null;
        if (isVisible) {
          console.log(`🟡 Visible input: "${placeholder}"`);
        }
      }
      throw new Error("❌ Still couldn't find a usable search input.");
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

      const advertiser = await ad
        .evaluate((node) => {
          const container = node as HTMLElement;
          const strong = container.querySelector("strong");
          return strong?.textContent?.trim() || "";
        })
        .catch(() => "");

      const content = await ad
        .evaluate((node) => {
          const container = node as HTMLElement;
          return container.textContent?.trim() || "";
        })
        .catch(() => "");

      const creativeUrl = await ad
        .evaluate((node) => {
          const container = node as HTMLElement;
          const img = container.querySelector("img");
          return img?.src || null;
        })
        .catch(() => null);

      // 🧠 Extract structured fields from content
      const startMatch = content.match(/Started running on (.+?) ·/);
      const start_date = startMatch
        ? new Date(startMatch[1]).toISOString().split("T")[0]
        : null;

      const spendMatch = content.match(/Amount spent \(USD\):([^\n]+)/);
      const spend = spendMatch ? spendMatch[1].trim() : null;

      const impressionsMatch = content.match(/Impressions:([^\n]+)/);
      const impressions = impressionsMatch ? impressionsMatch[1].trim() : null;

      const platforms: string[] = [];
      if (/facebook/i.test(content)) platforms.push("Facebook");
      if (/instagram/i.test(content)) platforms.push("Instagram");
      if (platforms.length === 0) platforms.push("Facebook"); // fallback

      ads.push({
        id: crypto.randomUUID(),
        advertiser,
        content,
        start_date,
        end_date: null,
        impressions,
        spend,
        platforms,
        creative_url: creativeUrl,
        demographics: {},
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
