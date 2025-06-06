"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const searchAdsHandler_1 = require("./mcp/searchAdsHandler");
function buildServer() {
    const server = new mcp_js_1.McpServer({
        name: "Facebook Ad Library MCP Server",
        version: "0.1.0",
    });
    server.tool("search_ads", "Search for Facebook ads with optional filters", {
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
    }, async (args) => {
        const { ads } = await (0, searchAdsHandler_1.searchAdsHandler)(args, {});
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({ ads }, null, 2)
                }]
        };
    });
    return server;
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post("/mcp", async (req, res) => {
    const server = buildServer();
    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
        sessionIdGenerator: () => (0, crypto_1.randomUUID)(), // SDK ≥ 1.3
    });
    res.on("close", () => {
        transport.close();
        server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});
app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
});
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🟢 MCP HTTP server listening on :${PORT}`));
