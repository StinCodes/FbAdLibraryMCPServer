"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAdsHandler = searchAdsHandler;
const scrapeFacebookAds_1 = require("../scraper/scrapeFacebookAds");
const filters_1 = require("../utils/filters");
/**
 * MCP tool handler: "search_ads"
 * Called by the MCP runtime with a parsed `arguments` object.
 */
async function searchAdsHandler(args, _ctx) {
    //Normalise data
    const { company = "", start_date, end_date, keywords = [], limit = 50, order = "date_desc", } = args;
    //Limit doesnt exceed scraper limit
    const effectiveLimit = Math.min(limit, 100);
    //Scrape
    const rawAds = await (0, scrapeFacebookAds_1.scrapeFacebookAds)({
        company,
    });
    console.log(`🔗 Scraper returned ${rawAds.length} ads`);
    //Filter by date and keyword
    const filtered = rawAds.filter((ad) => (0, filters_1.withinDateRange)(ad, start_date, end_date) && (0, filters_1.keywordMatch)(ad, keywords));
    //Sort
    const sorted = filtered.sort((a, b) => {
        const dA = (0, filters_1.parseDate)(a.start_date);
        const dB = (0, filters_1.parseDate)(b.start_date);
        // Fallback to 0 if both dates missing
        if (!dA && !dB)
            return 0;
        if (!dA)
            return 1;
        if (!dB)
            return -1;
        if (order === "date_asc")
            return dA.getTime() - dB.getTime();
        /* date_desc or relevance default */
        return dB.getTime() - dA.getTime();
    });
    //Limit
    const ads = sorted.slice(0, effectiveLimit);
    //Return MCP object
    return { ads };
}
