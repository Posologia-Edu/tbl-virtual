// Shared AI provider orchestration for edge functions that call an LLM.
// Tries the user's configured external API keys (ai_api_keys table) first,
// in a preferred order, and only falls back to the Lovable AI gateway
// (LOVABLE_API_KEY) as the platform's default model when no external key is
// configured or all of them fail — matching the behavior described to users
// on the "API Keys externas" settings page.

export interface AIResult {
  content: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  toolArguments?: string;
}

interface ProviderConfig {
  url: string;
  model: string;
  isAnthropic?: boolean;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
    isAnthropic: true,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
};

export const DEFAULT_PROVIDER_ORDER = ["google", "openai", "groq", "openrouter", "anthropic"];

export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("PROVIDER_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface ChatOptions {
  jsonMode?: boolean;
  tools?: any[];
  toolChoice?: any;
  timeoutMs?: number;
}

export async function tryExternalProvider(
  provider: string,
  apiKey: string,
  messages: any[],
  options: ChatOptions = {},
): Promise<AIResult | null> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return null;

  try {
    const isAnthropic = !!config.isAnthropic;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAnthropic) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let body: any;
    if (isAnthropic) {
      body = {
        model: config.model,
        max_tokens: 8192,
        system: messages.find((m: any) => m.role === "system")?.content || "",
        messages: messages.filter((m: any) => m.role !== "system"),
      };
    } else {
      body = { model: config.model, messages };
      if (options.jsonMode) body.response_format = { type: "json_object" };
      if (options.tools) {
        body.tools = options.tools;
        if (options.toolChoice) body.tool_choice = options.toolChoice;
      }
    }

    console.log(`[AI] Trying provider: ${provider}`);
    const res = await fetchWithTimeout(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, options.timeoutMs ?? 25000);

    if (!res.ok) {
      const t = await res.text();
      console.error(`[AI] ${provider} failed (${res.status}): ${t}`);
      return null;
    }

    const data = await res.json();

    let content: string | null = null;
    let toolArguments: string | undefined;
    let tokensInput = 0;
    let tokensOutput = 0;

    if (isAnthropic) {
      content = data.content?.[0]?.text || null;
      tokensInput = data.usage?.input_tokens ?? 0;
      tokensOutput = data.usage?.output_tokens ?? 0;
    } else {
      const msg = data.choices?.[0]?.message;
      content = msg?.content || null;
      toolArguments = msg?.tool_calls?.[0]?.function?.arguments;
      tokensInput = data.usage?.prompt_tokens ?? 0;
      tokensOutput = data.usage?.completion_tokens ?? 0;
    }

    if (!content && !toolArguments) return null;

    return { content: content || "", provider, model: config.model, tokensInput, tokensOutput, toolArguments };
  } catch (e) {
    console.error(`[AI] ${provider} error:`, e);
    return null;
  }
}

export async function tryLovableAI(
  messages: any[],
  options: ChatOptions & { model?: string } = {},
): Promise<AIResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const model = options.model ?? "google/gemini-2.5-flash";
  console.log("[AI] Using Lovable AI (platform default fallback)");

  const body: any = { model, messages };
  if (options.jsonMode) body.response_format = { type: "json_object" };
  if (options.tools) {
    body.tools = options.tools;
    if (options.toolChoice) body.tool_choice = options.toolChoice;
  }

  const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, options.timeoutMs ?? 25000);

  if (!response.ok) {
    const t = await response.text();
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    if (t.includes("context length") || t.includes("too many tokens")) throw new Error("CONTEXT_TOO_LARGE");
    throw new Error(`Lovable AI error ${response.status}: ${t}`);
  }

  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  const content = msg?.content || "";
  const toolArguments = msg?.tool_calls?.[0]?.function?.arguments;
  const tokensInput = data.usage?.prompt_tokens ?? 0;
  const tokensOutput = data.usage?.completion_tokens ?? 0;

  return { content, provider: "lovable", model, tokensInput, tokensOutput, toolArguments };
}

export async function getConfiguredApiKeys(supabaseClient: any): Promise<{ provider: string; api_key: string }[]> {
  const { data, error } = await supabaseClient.from("ai_api_keys").select("provider, api_key");
  if (error) throw error;
  return data ?? [];
}
