import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_SETTINGS, normalizeLLMSettings } from "@/lib/ai/llm-settings";
import { getLLMProvider } from "./index";

test("normalizeLLMSettings keeps default baseUrl when input baseUrl is missing", () => {
  assert.equal(
    normalizeLLMSettings({ apiKey: "user-key", baseUrl: undefined }).baseUrl,
    DEFAULT_LLM_SETTINGS.baseUrl
  );
  assert.equal(
    normalizeLLMSettings({ apiKey: "user-key", baseUrl: "   " }).baseUrl,
    DEFAULT_LLM_SETTINGS.baseUrl
  );
});

test("runtime API key without baseUrl falls back to default DeepSeek URL", async (t) => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFallbackKey = process.env.LLM_API_KEY;
  const previousAllowedBaseUrls = process.env.LLM_ALLOWED_BASE_URLS;
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";

  t.after(() => {
    if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
    if (previousFallbackKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousFallbackKey;
    if (previousAllowedBaseUrls === undefined) delete process.env.LLM_ALLOWED_BASE_URLS;
    else process.env.LLM_ALLOWED_BASE_URLS = previousAllowedBaseUrls;
    globalThis.fetch = previousFetch;
  });

  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_ALLOWED_BASE_URLS;
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const provider = getLLMProvider({ apiKey: "user-key" });
  await provider.generateText([{ role: "user", content: "hello" }]);
  assert.equal(requestedUrl, "https://api.deepseek.com/chat/completions");
});

test("local env API key takes priority over browser runtime key", async (t) => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousBaseUrl = process.env.DEEPSEEK_BASE_URL;
  const previousFallbackKey = process.env.LLM_API_KEY;
  const previousFetch = globalThis.fetch;

  t.after(() => {
    if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = previousBaseUrl;
    if (previousFallbackKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousFallbackKey;
    globalThis.fetch = previousFetch;
  });

  process.env.DEEPSEEK_API_KEY = "server-secret";
  process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com";
  delete process.env.LLM_API_KEY;

  let authorization = "";
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const provider = getLLMProvider({
    apiKey: "browser-secret",
    baseUrl: "https://api.deepseek.com",
  });
  await provider.generateText([{ role: "user", content: "hello" }]);
  assert.equal(authorization, "Bearer server-secret");
});

test("server API keys cannot be redirected to a runtime base URL", async (t) => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousBaseUrl = process.env.DEEPSEEK_BASE_URL;
  const previousFallbackKey = process.env.LLM_API_KEY;
  const previousFetch = globalThis.fetch;

  t.after(() => {
    if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = previousBaseUrl;
    if (previousFallbackKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousFallbackKey;
    globalThis.fetch = previousFetch;
  });

  process.env.DEEPSEEK_API_KEY = "server-secret";
  process.env.DEEPSEEK_BASE_URL = "https://server.example/v1";
  delete process.env.LLM_API_KEY;

  let requestedUrl = "";
  let authorization = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const provider = getLLMProvider({
    apiKey: "",
    baseUrl: "https://attacker.example/v1",
  });
  await provider.generateText([{ role: "user", content: "hello" }]);

  assert.equal(requestedUrl, "https://server.example/v1/chat/completions");
  assert.equal(authorization, "Bearer server-secret");
});

test("runtime API keys reject base URLs outside the allowlist", async (t) => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFallbackKey = process.env.LLM_API_KEY;
  const previousAllowedBaseUrls = process.env.LLM_ALLOWED_BASE_URLS;
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;

  t.after(() => {
    if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
    if (previousFallbackKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousFallbackKey;
    if (previousAllowedBaseUrls === undefined) delete process.env.LLM_ALLOWED_BASE_URLS;
    else process.env.LLM_ALLOWED_BASE_URLS = previousAllowedBaseUrls;
    globalThis.fetch = previousFetch;
  });

  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_ALLOWED_BASE_URLS;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("must not fetch");
  };

  assert.throws(
    () =>
      getLLMProvider({
        apiKey: "user-secret",
        baseUrl: "https://attacker.example/v1",
      }),
    /不在允许列表/
  );
  assert.equal(fetchCalled, false);
});
