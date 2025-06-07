import express, { Request, Response } from "express";
import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { searchAdsHandler } from "./mcp/searchAdsHandler";

function buildServer(): McpServer {
  const server = new McpServer({
    name: "Facebook Ad Library MCP Server",
    version: "0.1.0",
  });

  server.tool(
    "search_ads",
    "Search for Facebook ads with optional filters",
    {
      company: {
        type: "string",
        description: "Company/advertiser name to filter by (optional)"
      },
      start_date: {
        type: "string", 
        description: "Start date for ad search (YYYY-MM-DD format, optional)"
      },
      end_date: {
        type: "string",
        description: "End date for ad search (YYYY-MM-DD format, optional)" 
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "Keywords to search in ad content (optional)"
      },
      limit: {
        type: "number",
        description: "Maximum number of ads to return (optional, default: 50)"
      },
      order: {
        type: "string",
        enum: ["date_desc", "date_asc", "relevance"],
        description: "Sort order for results (optional, default: date_desc)"
      }
    },
    async (args) => {
      const { ads } = await searchAdsHandler(args as any, {});
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ ads }, null, 2)
        }] 
      };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// Create a single server instance
const mcpServer = buildServer();

app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  res.on("close", () => {
    transport.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Simple test endpoint for demonstration
app.post("/test-search", async (req: Request, res: Response) => {
  try {
    const { company = "McDonald", limit = 3, ...otherArgs } = req.body;
    console.log(`🔍 Testing search for: ${company}`);
    
    const { ads } = await searchAdsHandler({ company, limit, ...otherArgs }, {});
    
    res.json({ 
      success: true, 
      query: { company, limit, ...otherArgs },
      results: ads.length,
      ads 
    });
  } catch (error) {
    console.error("❌ Search failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      query: req.body 
    });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () =>
  console.log(`🟢 MCP HTTP server listening on :${PORT}`)
);
