"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tools = void 0;
exports.tools = [
    {
        name: "search_ads",
        description: "Search Facebook Ad Library",
        inputSchema: {
            type: "object",
            properties: {
                company: { type: "string" },
                start_date: { type: "string", format: "date" },
                end_date: { type: "string", format: "date" },
                keywords: {
                    type: "array",
                    items: { type: "string" },
                },
                limit: { type: "integer", default: 50 },
                order: {
                    type: "string",
                    enum: ["date_desc", "date_asc", "relevance"],
                    default: "date_desc",
                },
            },
        },
    },
];
