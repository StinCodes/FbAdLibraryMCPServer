import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

/* ── MCP SDK imports ─────────────────────────────────── */
/* Verify which filename exists in node_modules:         *
 *   server/transport-streamable-http.js   ↔ v0.5.x       *
 *   server/streamableHttp.js              ↔ older builds *
 * Pick whichever your install has.                      */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { tools } from "./mcp/tools";
import { searchAdsHandler } from "./mcp/searchAdsHandler";

/*─────────────────────────────────────────────────────────*
 * Build a fresh MCP server per request (stateless)        *
 *─────────────────────────────────────────────────────────*/
function buildServer(): McpServer {
  const server = new McpServer({
    name: "Facebook Ad Library MCP Server",
    version: "0.1.0",
  });

  /* 1️⃣  Provide a **raw Zod shape**, not a ZodObject      */
  const searchShape: Record<string, z.ZodTypeAny> =
    tools[0].inputSchema.properties as Record<string, z.ZodTypeAny>;

  /* 2️⃣  Use the 3-argument overload: name, shape, handler */
  server.tool(
    "search_ads",
    searchShape,
    async (args) => {
      const { ads } = await searchAdsHandler(args as any, {});
      return { content: [{ type: "json", json: { ads } }] };
    }
  );

  return server;
}

/*─────────────────────────────────────────────────────────*
 * Express bridge                                          *
 *─────────────────────────────────────────────────────────*/
const app = express();
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  /* fresh instances each request → no ID collisions */
  const server = buildServer();

  /* 3️⃣  Option key is **sessionIdGenerator** in v0.5.x    */
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

/* Simple health probe (keep as a plain route) */
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () =>
  console.log(`🟢 MCP HTTP server listening on :${PORT}`)
);
