import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { DeepSeekProvider } from "./deepseek-provider";

test("structured retry identifies the invalid field and final errors retain its path", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ messages: Array<{ content: string }> }> = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ message: { content: '{"title":42}' } }] });
  };
  try {
    const provider = new DeepSeekProvider({ apiKey: "test", model: "test" });
    await assert.rejects(provider.generateStructuredOutput([], z.object({ title: z.string() })), /title/);
    assert.match(calls[1].messages.at(-1)!.content, /title/);
  } finally { globalThis.fetch = original; }
});
