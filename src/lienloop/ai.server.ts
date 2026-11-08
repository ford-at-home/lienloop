// Server-only call to the built-in Lovable AI Gateway, native Anthropic Messages endpoint, streamed.
import { MAX_OUTPUT_TOKENS, MODEL } from "./hosted";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "thinking"; thinking: string; signature?: string };

export interface ModelResult {
  content: ContentBlock[];
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  gatewayRunId: string | null;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function callModel(opts: { system: string; messages: unknown[]; tools: unknown[]; runId: string | null }): Promise<ModelResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError("The built-in AI connector key is not configured for this project.", 401);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Lovable-AIG-SDK": "fetch",
  };
  if (opts.runId) headers["X-Lovable-AIG-Run-ID"] = opts.runId;
  const response = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      system: opts.system,
      tools: opts.tools,
      tool_choice: { type: "any", disable_parallel_tool_use: false },
      messages: opts.messages,
    }),
  });
  const gatewayRunId = response.headers.get("X-Lovable-AIG-Run-ID") ?? opts.runId;
  if (!response.ok || !response.body) {
    let message = `AI gateway returned HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: { message?: string }; message?: string };
      const m = body.error?.message ?? body.message;
      if (m) message = `AI gateway HTTP ${response.status}: ${m.slice(0, 300)}`;
    } catch {
      /* ignore */
    }
    throw new GatewayError(message, response.status);
  }

  const blocks: (ContentBlock & { _json?: string })[] = [];
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let ev: Record<string, any>;
      try {
        ev = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      switch (ev["type"]) {
        case "message_start":
          inputTokens = ev["message"]?.usage?.input_tokens ?? 0;
          break;
        case "content_block_start": {
          const b = ev["content_block"];
          if (b.type === "tool_use") blocks[ev["index"]] = { type: "tool_use", id: b.id, name: b.name, input: {}, _json: "" };
          else if (b.type === "text") blocks[ev["index"]] = { type: "text", text: b.text ?? "" };
          else if (b.type === "thinking") blocks[ev["index"]] = { type: "thinking", thinking: "" };
          break;
        }
        case "content_block_delta": {
          const b = blocks[ev["index"]];
          const d = ev["delta"];
          if (!b) break;
          if (d.type === "text_delta" && b.type === "text") b.text += d.text;
          else if (d.type === "input_json_delta" && b.type === "tool_use") b._json = (b._json ?? "") + d.partial_json;
          else if (d.type === "thinking_delta" && b.type === "thinking") b.thinking += d.thinking;
          else if (d.type === "signature_delta" && b.type === "thinking") b.signature = d.signature;
          break;
        }
        case "message_delta":
          stopReason = ev["delta"]?.stop_reason ?? stopReason;
          outputTokens = ev["usage"]?.output_tokens ?? outputTokens;
          break;
        case "error":
          throw new GatewayError(`AI gateway stream error: ${String(ev["error"]?.message ?? "unknown").slice(0, 300)}`, 502);
        case "message_stop":
          done = true;
          break;
      }
    }
  }
  const content: ContentBlock[] = blocks.filter(Boolean).map((b) => {
    if (b.type === "tool_use") {
      let input: unknown = {};
      try {
        input = b._json ? JSON.parse(b._json) : {};
      } catch {
        input = { _unparseable: true };
      }
      return { type: "tool_use", id: b.id, name: b.name, input };
    }
    const { _json, ...rest } = b;
    return rest as ContentBlock;
  });
  if (stopReason === "refusal") throw new GatewayError("The model declined this request (refusal). No action was taken.", 200);
  return { content, stopReason, inputTokens, outputTokens, gatewayRunId };
}
