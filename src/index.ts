import { createServer } from "mcp-sdk";
import { tools } from "./mcp/tools";
import { searchAdsHandler } from "./mcp/searchAdsHandler";

createServer({
  tools,
  handlers: { search_ads: searchAdsHandler },
}).listen(3000, () => console.log("🟢 MCP server ready on :3000"));
