"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const searchAdsHandler_1 = require("./mcp/searchAdsHandler");
const searchAdsParams = {
    company: zod_1.z.string().optional(),
    start_date: zod_1.z.string().optional(),
    end_date: zod_1.z.string().optional(),
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    limit: zod_1.z.number().int().optional().default(50),
    order: zod_1.z.enum(["date_desc", "date_asc", "relevance"]).optional(),
};
function buildServer() {
    const server = new mcp_js_1.McpServer({
        name: "Facebook Ad Library MCP Server",
        version: "0.1.0",
    });
    server.tool("search_ads", searchAdsParams, async (args) => {
        const { ads } = await (0, searchAdsHandler_1.searchAdsHandler)(args, {});
        return { content: [{ type: "json", json: { ads } }] };
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
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🟢 MCP HTTP server listening on :${PORT}`));
