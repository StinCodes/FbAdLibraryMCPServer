import { chromium } from "playwright";
import crypto from "crypto";

export interface ScrapeInput {
  company?: string;
  start_date?: string;
  end_date?: string;
  keywords?: string[];
}

export async function scrapeFacebookAds({ company }: ScrapeInput) {
  // Start virtual display in production (makes cloud behave like local)
  if (process.env.NODE_ENV === 'production') {
    const { exec } = require('child_process');
    exec('Xvfb :99 -screen 0 1920x1080x24 &');
    process.env.DISPLAY = ':99';
    console.log('🖥️ Started virtual display for non-headless browser');
  }

  // Simplified browser setup - no complex stealth scripts
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  // Simple context - just basic settings
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  try {
    // Add random mouse movement to appear more human-like
    await page.mouse.move(Math.random() * 100, Math.random() * 100);
    
    await page.goto("https://www.facebook.com/ads/library/", {
      waitUntil: "domcontentloaded",
    });

    // Random delay between 3-7 seconds instead of fixed 5
    await page.waitForTimeout(3000 + Math.random() * 4000);
    
    // Debug: Check what Facebook is actually showing us
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`🔍 Current URL: ${currentUrl}`);
    console.log(`🔍 Page title: ${pageTitle}`);
    
    // Check for common blocking scenarios
    const pageContent = await page.content();
    if (pageContent.includes('captcha') || pageContent.includes('CAPTCHA')) {
      console.log('🚫 CAPTCHA detected!');
    }
    if (pageContent.includes('blocked') || pageContent.includes('security')) {
      console.log('🚫 Security block detected!');
    }
    if (currentUrl.includes('checkpoint') || currentUrl.includes('login')) {
      console.log('🚫 Redirected to login/checkpoint!');
    }
    
    // Take screenshot for debugging (only in production to see what Facebook shows)
    if (process.env.NODE_ENV === 'production') {
      try {
        await page.screenshot({ path: '/tmp/facebook-debug.png', fullPage: true });
        console.log('📸 Debug screenshot saved to /tmp/facebook-debug.png');
      } catch (e) {
        console.log('📸 Screenshot failed:', e);
      }
    }

    /* ───────── Cookie banner ───────── */
    try {
      const acceptBtn = page.getByText("Allow all cookies", { exact: true });
      if (await acceptBtn.isVisible()) {
        console.log("✅ Clicking Allow Cookies…");
        await acceptBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch {
      console.log("⚠️ 'Allow all cookies' button not found or not visible.");
    }

    /* ───────── Ad category → All ads ───────── */
    const adCategoryButton = page.getByText("Ad category", { exact: true });
    await adCategoryButton.waitFor({ timeout: 10000 });
    console.log("🔽 Clicking 'Ad category' dropdown…");
    await adCategoryButton.click();
    await page.waitForTimeout(1000);

    console.log("✅ Looking for 'All ads' option…");
    const allAdsOption = page.getByText("All ads", { exact: true });
    if (!(await allAdsOption.isVisible())) {
      throw new Error("❌ Could not find a visible 'All ads' option to click.");
    }

    await allAdsOption.click();
    console.log("✅ 'All ads' selected.");
    await page.waitForTimeout(2000);

    /* ───────── Search input ───────── */
    console.log("🔍 Waiting for search input to appear…");
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

    if (!searchInput) throw new Error("❌ Could not find a usable search input.");

    await searchInput.click();
    // Human-like typing with random delays
    const searchTerm = company || "";
    for (const char of searchTerm) {
      await page.keyboard.type(char, { delay: 80 + Math.random() * 120 });
    }
    await page.waitForTimeout(500 + Math.random() * 1000);
    await page.keyboard.press("Enter");

    /* ───────── Wait for first results ───────── */
    console.log("⏳ Waiting for ads or 'no results' message…");
    const resultsOrEmpty = await Promise.race([
      page
        .waitForSelector("text=Library ID", { timeout: 15000, state: "attached" })
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

    /* ───────── Initial nudge to trigger lazy load ───────── */
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(2000);

    /* ───────────────────────────────────────────────────────
     * 🔄 Pagination loop (NEW – everything below this comment
     *    is additive; nothing above was removed or altered)
     * ─────────────────────────────────────────────────────── */
    console.log("🔄 Starting auto-scroll pagination…");

    let previousAdCount = 0;
    let sameCountRounds = 0;
    const maxSameCountRounds = 3;   // stop after 3 scrolls with no change
    const MAX_ADS = 100; //Ad load limit

    while (sameCountRounds < maxSameCountRounds) {
      // Scroll near the bottom
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await page.waitForTimeout(2000); // allow ads to load

      const currentAdCount = await page.locator("text=Library ID").count();
      console.log(
        `↻ Scroll ${sameCountRounds + 1}/${maxSameCountRounds} | ads on page: ${currentAdCount}`
      );
      if (currentAdCount >= MAX_ADS) break;

      if (currentAdCount === previousAdCount) {
        sameCountRounds += 1;       // no new ads this round
      } else {
        previousAdCount = currentAdCount;
        sameCountRounds = 0;        // progress made; reset counter
      }
    }

    console.log("✅ Pagination complete – no new ads appearing.");

    /* ───────── Collect and parse ads ───────── */
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
        const nameEl =
          el.querySelector("strong") || el.querySelector('[role="heading"]');
        return nameEl?.textContent?.trim() || "";
      });

      const startDateMatch = rawText.match(/Started running on (.+?) ·/);
      const endDateMatch = rawText.match(/Ended on (.+?)(?: ·|$)/);
      const impressionsMatch = rawText.match(
        /Impressions:\s*([<\d,]+(?:K|M)?)/,
      );
      const spendMatch = rawText.match(
        /Amount spent.*?:\s*(.+?)(?:Impressions|$)/,
      );

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
        const lines = Array.from(el.querySelectorAll("span, div")).map(
          (e) => e.textContent || "",
        );
        return (
          lines.find((line) => line.includes("People who may see this ad")) || ""
        );
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
