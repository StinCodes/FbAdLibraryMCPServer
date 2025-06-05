import { scrapeFacebookAds } from "../scraper/scrapeFacebookAds";
import { withinDateRange, keywordMatch, parseDate } from "../utils/filters";

interface SearchAdsArgs {
  company?: string;
  start_date?: string;
  end_date?: string;
  keywords?: string[];
  limit?: number; 
  order?: "date_desc" | "date_asc" | "relevance";
}

/**
 * MCP tool handler: "search_ads"
 * Called by the MCP runtime with a parsed `arguments` object.
 */
export async function searchAdsHandler(args: SearchAdsArgs, _ctx: unknown) {
  //Normalise data
  const {
    company = "",
    start_date,
    end_date,
    keywords = [],
    limit = 50,
    order = "date_desc",
  } = args;

  //Limit doesnt exceed scraper limit
  const effectiveLimit = Math.min(limit, 100);

  //Scrape
  const rawAds = await scrapeFacebookAds({
    company,
  });

  console.log(`🔗 Scraper returned ${rawAds.length} ads`);

  //Filter by date and keyword
  const filtered = rawAds.filter(
    (ad) =>
      withinDateRange(ad, start_date, end_date) && keywordMatch(ad, keywords)
  );

  //Sort
  const sorted = filtered.sort((a, b) => {
    const dA = parseDate(a.start_date);
    const dB = parseDate(b.start_date);

    // Fallback to 0 if both dates missing
    if (!dA && !dB) return 0;
    if (!dA) return 1;
    if (!dB) return -1;

    if (order === "date_asc") return dA.getTime() - dB.getTime();
    /* date_desc or relevance default */
    return dB.getTime() - dA.getTime();
  });

  //Limit
  const ads = sorted.slice(0, effectiveLimit);

  //Return MCP object
  return { ads };
}
