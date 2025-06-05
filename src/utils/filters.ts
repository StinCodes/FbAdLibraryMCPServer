import { parse, isValid, isAfter, isBefore } from "date-fns";


export interface AdRecord {
  advertiser: string;
  content: string;
  start_date: string | null;
  end_date: string | null;
}

//Try several FB date formats → return a JS Date or null
export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;

  const formats = ["MMM d, yyyy", "MMMM d, yyyy"];

  for (const fmt of formats) {
    const d = parse(raw, fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

//Returns true if the ad ran at all within [filterStart, filterEnd] (inclusive).
export function withinDateRange(
  ad: AdRecord,
  filterStart?: string,
  filterEnd?: string
): boolean {
  if (!filterStart && !filterEnd) return true;

  const adStart = parseDate(ad.start_date);
  const adEnd = parseDate(ad.end_date);
  const rangeStart = parseDate(filterStart ?? null);
  const rangeEnd = parseDate(filterEnd ?? null);

  // If the ad supplies no usable dates, keep it
  if (!adStart && !adEnd) return true;

  // Convert missing bounds to -∞ / +∞ semantics
  const startsOK =
    !rangeStart ||
    (adStart ? !isBefore(adStart, rangeStart) : true) ||
    (adEnd ? !isBefore(adEnd, rangeStart) : false);

  const endsOK =
    !rangeEnd ||
    (adEnd ? !isAfter(adEnd, rangeEnd) : true) ||
    (adStart ? !isAfter(adStart, rangeEnd) : false);

  return startsOK && endsOK;
}

//True if ANY keyword appears (case-insensitive) in ad.content or advertiser. Empty or missing -> match everything
export function keywordMatch(ad: AdRecord, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;

  const haystack = (ad.content + " " + ad.advertiser).toLowerCase();

  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}
