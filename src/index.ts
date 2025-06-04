import { scrapeFacebookAds } from './scraper/scrapeFacebookAds';

(async () => {
  const ads = await scrapeFacebookAds({
    company: 'Nike',
    keywords: ['shoes'],
    start_date: '2024-01-01',
    end_date: '2024-01-31',
  });

  console.log('Scraped Ads:', ads);
})();
