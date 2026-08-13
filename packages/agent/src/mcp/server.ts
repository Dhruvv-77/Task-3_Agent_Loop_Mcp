import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { readFileTool } from "../tools/readFile.js";
import { grepTool } from "../tools/grep.js";
import { runTest } from "../tools/runTest.js";
import { runLoop } from "../loop.js";

const server = new Server(
    {
        name: "intern-agent",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "read_file",
            description: "Read a file from the repository",
            inputSchema: {
                type: "object",
                properties: {
                    path: { type: "string" },
                },
                required: ["path"],
            },
        },
        {
            name: "grep",
            description: "Search for text inside repository files",
            inputSchema: {
                type: "object",
                properties: {
                    pattern: { type: "string" },
                },
                required: ["pattern"],
            },
        },
        {
            name: "run_test",
            description: "Run a single test file",
            inputSchema: {
                type: "object",
                properties: {
                    testFile: { type: "string" },
                },
                required: ["testFile"],
            },
        },
        {
            name: "fix_test",
            description: "Run the full agent loop on one failing test",
            inputSchema: {
                type: "object",
                properties: {
                    testFile: { type: "string" },
                },
                required: ["testFile"],
            },
        },
    ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;


    switch (name) {
        case "read_file": {
            const filePath = String(args?.path ?? "");
            const output = await readFileTool(filePath);
            return {
                content: [{ type: "text", text: output }],
            };
        }

        case "grep": {
            const pattern = String(args?.pattern ?? "");
            const output = await grepTool(pattern);
            return {
                content: [{ type: "text", text: output }],
            };
        }

        case "run_test": {
            const testFile = String(args?.testFile ?? "");
            const result = runTest(testFile);
            return {
                content: [{ type: "text", text: result.output }],
            };
        }

        case "fix_test": {
            const testFile = String(args?.testFile ?? "");
            await runLoop(testFile);
            return {
                content: [
                    {
                        type: "text",
                        text: `Finished agent loop for ${testFile}`,
                    },
                ],
            };
        }

        default:
            throw new Error(`Unknown tool: ${name} `);
    }


});

const transport = new StdioServerTransport();
await server.connect(transport);
