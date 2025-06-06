import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { searchAdsHandler } from "./mcp/searchAdsHandler";

const searchAdsParams = {
  company: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  limit: z.number().int().optional().default(50),
  order: z.enum(["date_desc", "date_asc", "relevance"]).optional(),
} as const;

function buildServer(): McpServer {
  const server = new McpServer({
    name: "Facebook Ad Library MCP Server",
    version: "0.1.0",
  });

  server.tool(
    "search_ads",
    searchAdsParams,
    async (args) => {
      const { ads } = await searchAdsHandler(args as any, {});
      return { content: [{ type: "json", json: { ads } }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  const server = buildServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(), // SDK ≥ 1.3
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get(
  "/healthz",
  (_req: Request, res: Response) => res.json({ status: "ok" })
);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () =>
  console.log(`🟢 MCP HTTP server listening on :${PORT}`)
);
