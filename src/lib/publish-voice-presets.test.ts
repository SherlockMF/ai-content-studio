import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PUBLISH_VOICE } from "./defaults";
import { applyPublishVoicePreset, PUBLISH_VOICE_PRESETS } from "./publish-voice-presets";

test("切换人设预设时保留用户的公众号名称并应用其余配置", () => {
  const current = { ...DEFAULT_PUBLISH_VOICE, accountName: "AIFriday" };
  const preset = PUBLISH_VOICE_PRESETS[1];
  const result = applyPublishVoicePreset(preset, current);
  assert.equal(result.accountName, "AIFriday");
  assert.equal(result.voice, preset.voice.voice);
  assert.equal(result.audience, preset.voice.audience);
  assert.equal(result.id, current.id);
});
