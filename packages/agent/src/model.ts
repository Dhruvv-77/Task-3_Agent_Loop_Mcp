import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });

export interface ToolCall {
    tool: "read_file" | "list_dir" | "grep" | "propose_edit" | "run_test";
    arguments: Record<string, any>;
}

export interface ModelCallResult {
    ok: boolean;
    toolCall?: ToolCall;
    error?: string;
    rawResponse?: string;
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

export async function queryModel(
    systemPrompt: string,
    messages: { role: string; content: string }[]
): Promise<ModelCallResult> {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY environment variable is not set. Please set it before running the agent."
        );
    }

    const payload = {
        model: GROQ_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            ...messages
        ],
        response_format: { type: "json_object" }
    };

    let res: Response | null = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify(payload)
            });
        } catch (err: any) {
            if (attempts >= maxAttempts) {
                throw new Error(
                    `Groq API connection failed after ${maxAttempts} attempts. Error: ${err.message}`
                );
            }
            console.warn(`[Connection Warning] Attempt ${attempts} failed: ${err.message}. Retrying in 2 seconds...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
        }

        if (res.status === 429) {
            const retryAfterHeader = res.headers.get("retry-after");
            let waitSec = 3;
            if (retryAfterHeader) {
                const parsed = parseFloat(retryAfterHeader);
                if (!isNaN(parsed) && parsed > 0) {
                    waitSec = Math.ceil(parsed);
                }
            }
            console.warn(`[Rate Limit] Hit 429 (Rate Limit). Waiting ${waitSec} seconds before retrying (Attempt ${attempts}/${maxAttempts})...`);
            await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
            continue;
        }

        break;
    }

    if (!res) {
        throw new Error("Groq API query failed: No response object was created.");
    }

    if (!res.ok) {
        let errMsg = `Groq API returned status ${res.status}`;
        try {
            const errData = await res.json();
            if (errData?.error?.message) {
                errMsg += `: ${errData.error.message}`;
            } else {
                errMsg += `: ${JSON.stringify(errData)}`;
            }
        } catch {
            errMsg += `: ${await res.text()}`;
        }
        throw new Error(errMsg);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    try {
        const parsed = JSON.parse(content);

        // Check if response is a tool call object
        if (parsed && typeof parsed === "object" && typeof parsed.tool === "string") {
            const tool = parsed.tool;
            const validTools = ["read_file", "list_dir", "grep", "propose_edit", "run_test"];

            if (!validTools.includes(tool)) {
                return {
                    ok: false,
                    error: `Unknown tool requested: ${tool}`,
                    rawResponse: content
                };
            }

            return {
                ok: true,
                toolCall: {
                    tool: tool as ToolCall["tool"],
                    arguments: parsed.arguments || {}
                },
                rawResponse: content
            };
        }

        // If array returned (multiple tool calls requested)
        if (Array.isArray(parsed)) {
            return {
                ok: false,
                error: "Malformed tool call: model returned array of tools instead of single tool call",
                rawResponse: content
            };
        }

        return {
            ok: false,
            error: "Malformed tool call: response missing 'tool' string property",
            rawResponse: content
        };
    } catch (err) {
        return {
            ok: false,
            error: "Malformed tool call: JSON parse failed",
            rawResponse: content
        };
    }
}
