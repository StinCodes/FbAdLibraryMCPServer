# Facebook Ad Library MCP Server

A Model Context Protocol (MCP) server that provides access to Facebook's Ad Library through web scraping. This server exposes a single MCP tool for searching advertisements with comprehensive filtering options.

## Features

- **MCP-compliant**: Built using the official MCP SDK
- **Comprehensive ad data**: Extracts advertiser, content, dates, impressions, spend, and more
- **Advanced filtering**: Filter by company, date range, and keywords
- **Smart pagination**: Auto-scrolling to retrieve up to 100 ads per search
- **Flexible sorting**: Sort by date (ascending/descending) or relevance

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd FbAdLibraryMCPServer
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

The server will start on port 3000 (configurable via `PORT` environment variable).

## API Documentation

### MCP Tool: `search_ads`

Search for Facebook ads with optional filters.

**Parameters:**
- `company` (string, optional): Company/advertiser name to filter by
- `start_date` (string, optional): Start date in YYYY-MM-DD format
- `end_date` (string, optional): End date in YYYY-MM-DD format
- `keywords` (array of strings, optional): Keywords to search in ad content
- `limit` (integer, optional): Maximum ads to return (default: 50, max: 100)
- `order` (string, optional): Sort order - "date_desc", "date_asc", or "relevance" (default: "date_desc")

**Example Tool Call:**
```json
{
  "tool": "search_ads",
  "arguments": {
    "company": "Nike",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "keywords": ["running", "shoes"],
    "limit": 10,
    "order": "date_desc"
  }
}
```

**Response Format:**
```json
{
  "ads": [
    {
      "id": "unique_ad_identifier",
      "advertiser": "Company Name",
      "content": "Ad text content",
      "start_date": "Jan 15, 2024",
      "end_date": "Feb 15, 2024",
      "impressions": "1,000-5,000",
      "spend": "$100-$500",
      "platforms": ["Facebook"],
      "creative_url": "https://...",
      "demographics": {"targeting": "..."},
      "scraped_at": "2024-01-20T10:30:00Z"
    }
  ]
}
```

## MCP Client Connection

Connect to the server using any MCP-compatible client:

**HTTP Transport:**
- URL: `http://localhost:3000/mcp`
- Method: POST
- Headers: `Content-Type: application/json`

**Health Check:**
- URL: `http://localhost:3000/healthz`
- Method: GET

## Architecture

- **MCP Server** (`src/index.ts`): Express HTTP server hosting MCP protocol
- **Search Handler** (`src/mcp/searchAdsHandler.ts`): Core business logic
- **Web Scraper** (`src/scraper/scrapeFacebookAds.ts`): Playwright-based Facebook scraper
- **Filters** (`src/utils/filters.ts`): Date parsing and filtering utilities

## Performance Considerations

- **Rate Limiting**: Built-in delays between requests to avoid blocking
- **Pagination**: Auto-scrolling with intelligent stopping conditions
- **Browser Management**: Proper cleanup of Playwright browser instances
- **Memory Efficiency**: Streaming data processing where possible

## Known Limitations

- Runs in non-headless mode to avoid detection
- Limited to 100 ads per search to prevent timeouts
- Date formats depend on Facebook's display format
- Subject to Facebook's anti-bot measures

## Legal & Ethical Notes

- Respects Facebook's rate limiting through built-in delays
- Does not store personal user data
- Intended for research and analysis purposes
- Users should comply with Facebook's Terms of Service

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `playwright`: Web scraping automation
- `date-fns`: Date parsing and manipulation
- `express`: HTTP server framework
- `zod`: Runtime type validation

## Deployment (Fly.io)

1. **Install flyctl:**
```bash
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="/root/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"
```

2. **Deploy to Fly.io:**
```bash
flyctl auth signup
flyctl launch --no-deploy
flyctl secrets set NODE_ENV=production
flyctl deploy
```

3. **Live Deployment:**
   - App URL: `https://fbadlibrarymcpserver.fly.dev`
   - Health check: `https://fbadlibrarymcpserver.fly.dev/healthz`
   - MCP endpoint: `https://fbadlibrarymcpserver.fly.dev/mcp` (POST only)
   - Test endpoint: `https://fbadlibrarymcpserver.fly.dev/test-search` (GET/POST)

## Connection Details

**Public URL:** `https://fbadlibrarymcpserver.fly.dev`

**MCP Client Configuration:**
```json
{
  "transport": "http",
  "url": "https://fbadlibrarymcpserver.fly.dev/mcp",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
  }
}
```

**Authentication:** None required

## License

ISC
