"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDate = parseDate;
exports.withinDateRange = withinDateRange;
exports.keywordMatch = keywordMatch;
const date_fns_1 = require("date-fns");
//Try several FB date formats → return a JS Date or null
function parseDate(raw) {
    if (!raw)
        return null;
    const formats = ["MMM d, yyyy", "MMMM d, yyyy"];
    for (const fmt of formats) {
        const d = (0, date_fns_1.parse)(raw, fmt, new Date());
        if ((0, date_fns_1.isValid)(d))
            return d;
    }
    return null;
}
//Returns true if the ad ran at all within [filterStart, filterEnd] (inclusive).
function withinDateRange(ad, filterStart, filterEnd) {
    if (!filterStart && !filterEnd)
        return true;
    const adStart = parseDate(ad.start_date);
    const adEnd = parseDate(ad.end_date);
    const rangeStart = parseDate(filterStart ?? null);
    const rangeEnd = parseDate(filterEnd ?? null);
    // If the ad supplies no usable dates, keep it
    if (!adStart && !adEnd)
        return true;
    // Convert missing bounds to -∞ / +∞ semantics
    const startsOK = !rangeStart ||
        (adStart ? !(0, date_fns_1.isBefore)(adStart, rangeStart) : true) ||
        (adEnd ? !(0, date_fns_1.isBefore)(adEnd, rangeStart) : false);
    const endsOK = !rangeEnd ||
        (adEnd ? !(0, date_fns_1.isAfter)(adEnd, rangeEnd) : true) ||
        (adStart ? !(0, date_fns_1.isAfter)(adStart, rangeEnd) : false);
    return startsOK && endsOK;
}
//True if ANY keyword appears (case-insensitive) in ad.content or advertiser. Empty or missing -> match everything
function keywordMatch(ad, keywords) {
    if (!keywords || keywords.length === 0)
        return true;
    const haystack = (ad.content + " " + ad.advertiser).toLowerCase();
    return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}
