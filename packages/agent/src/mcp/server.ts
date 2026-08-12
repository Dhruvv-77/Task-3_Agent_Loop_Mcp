import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { ROOT } from "../config.js";

const server = new Server(
  {
    name: "agent-loop-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "Read a file from the corpus",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"]
      }
    },
    {
      name: "list_dir",
      description: "List files in a directory",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"]
      }
    },
    {
      name: "grep",
      description: "Search for a string in source files",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    },
    {
      name: "run_test",
      description: "Run a single Vitest test file",
      inputSchema: {
        type: "object",
        properties: {
          test: { type: "string" }
        },
        required: ["test"]
      }
    },
    {
      name: "propose_edit",
      description: "Return a proposed edit without writing it",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string" },
          before: { type: "string" },
          after: { type: "string" }
        },
        required: ["file", "before", "after"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "read_file": {
      const filePath = path.join(ROOT, String(args?.path));
      const text = await fs.readFile(filePath, "utf8");
      return { content: [{ type: "text", text }] };
    }

    case "list_dir": {
      const dirPath = path.join(ROOT, String(args?.path));
      const entries = await fs.readdir(dirPath);
      return {
        content: [{ type: "text", text: entries.join("\n") }]
      };
    }

    case "grep": {
      const query = String(args?.query);
      const output = execSync(
        `git grep -n ${JSON.stringify(query)}`,
        {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }
      );
      return { content: [{ type: "text", text: output }] };
    }

    case "run_test": {
      const test = String(args?.test);
      try {
        const output = execSync(
          `pnpm exec vitest run tests/${test}`,
          {
            cwd: ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          }
        );
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return {
          content: [
            {
              type: "text",
              text: e.stdout || e.stderr || String(e)
            }
          ]
        };
      }
    }

    case "propose_edit": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(args, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);