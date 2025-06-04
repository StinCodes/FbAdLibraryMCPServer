import { chromium } from "playwright";

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

    console.log("✅ Search submitted. Waiting for results...");
    await page.waitForTimeout(5000);

    // Scrape ad results
    const adHandles = await page.$$('div[role="article"]');
    const ads = [];

    for (const ad of adHandles) {
      const advertiser = await ad
        .$eval("strong", (el) => el.textContent?.trim() || "")
        .catch(() => "");

      const content = await ad.innerText().catch(() => "");
      const creativeUrl = await ad
        .$eval("img", (img) => (img as HTMLImageElement).src)
        .catch(() => null);

      ads.push({
        id: crypto.randomUUID(),
        advertiser,
        content,
        start_date: null,
        end_date: null,
        impressions: null,
        spend: null,
        platforms: ["Facebook"],
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
