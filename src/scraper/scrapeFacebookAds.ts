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
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      console.log('🖥️ Starting virtual display...');
      await execAsync('Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &');
      process.env.DISPLAY = ':99';
      // Give Xvfb time to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Virtual display started successfully');
    } catch (error) {
      console.log('⚠️ Virtual display setup failed, falling back to headless:', error);
    }
  }

  // Browser setup with timeout and better error handling
  const browser = await chromium.launch({ 
    headless: process.env.NODE_ENV === 'production' ? false : true, // Fallback to headless if display fails
    timeout: 30000, // 30 second timeout instead of default 3 minutes
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  // Simple context - just basic settings
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  try {
    // Visit homepage first - natural navigation pattern
    console.log("🏠 Visiting Facebook homepage first...");
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    
    // Now navigate to Ad Library naturally
    console.log("📚 Navigating to Ad Library...");
    await page.goto("https://www.facebook.com/ads/library/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    
    // Simplified detection - only check for actual security redirects
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`🔍 Current URL: ${currentUrl}`);
    console.log(`🔍 Page title: ${pageTitle}`);
    
    // Only trigger on actual redirects, not page content
    if (currentUrl.includes('checkpoint') || currentUrl.includes('security-check') || currentUrl.includes('login') || currentUrl.includes('/checkpoint/')) {
      console.log('🚫 Actually redirected to security page!');
      return [];
    }
    
    // Debug: What elements are actually on the page?
    console.log('🔍 Looking for available buttons and text...');
    const allButtons = await page.$$('button');
    console.log(`📊 Found ${allButtons.length} buttons on page`);
    
    for (let i = 0; i < Math.min(5, allButtons.length); i++) {
      const buttonText = await allButtons[i].textContent();
      console.log(`🔘 Button ${i}: "${buttonText}"`);
    }
    
    // Look for any text containing "category" or "ad"
    const categoryElements = await page.$$('text=/category|ad|filter/i');
    console.log(`📝 Found ${categoryElements.length} elements with category/ad/filter text`);
    
    for (let i = 0; i < Math.min(3, categoryElements.length); i++) {
      const text = await categoryElements[i].textContent();
      console.log(`📄 Text ${i}: "${text}"`);
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

    // Simple, natural typing
    await searchInput.click();
    await searchInput.fill(company || "");
    await page.keyboard.press("Enter");

    /* ───────── Wait for first results ───────── */
    console.log("⏳ Waiting for ads or 'no results' message…");
    
    // Wait for page to load after search
    await page.waitForTimeout(5000);
    
    // Debug: What's actually on the results page?
    console.log("🔍 Checking what's on the results page...");
    const pageContent = await page.content();
    
    // Check for various result indicators
    if (pageContent.includes("No results found") || pageContent.includes("no results")) {
      console.log("⚠️ No results found for this search");
      return [];
    }
    
    // Look for different ad indicators
    const possibleSelectors = [
      "text=Library ID",
      "text=Ad ID", 
      "text=ID:",
      "[data-testid*='ad']",
      ".x1i10hfl", // Common Facebook class for ad containers
      "text=Active",
      "text=Inactive"
    ];
    
    let resultsOrEmpty = "none"; // Default to none
    
    for (const selector of possibleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found ads using selector: ${selector}`);
          resultsOrEmpty = "ads";
          break;
        }
      } catch (e) {
        console.log(`❌ Selector failed: ${selector}`);
      }
    }
    
    // If no selectors work, let's see what text is actually there
    const pageText = await page.$$eval('*', els => 
      els.map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0 && text.length < 100)
        .slice(0, 20)
    );
    console.log("📄 Sample page text:", pageText);

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
