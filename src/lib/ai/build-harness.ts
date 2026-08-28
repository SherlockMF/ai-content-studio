import {
  ContentGoal,
  ContentSection,
  GenerationHarness,
  MaterialItem,
  PublishVoice,
  Topic,
} from "@/types/domain";

export function buildHarnessFromVoice(
  voice: PublishVoice,
  materials: MaterialItem[],
  overrides?: Partial<GenerationHarness>
): GenerationHarness {
  const enabledIds = materials.filter((item) => item.enabled).map((item) => item.id);
  return {
    section: voice.defaultSections[0] ?? "AI 通识",
    audienceFocus: voice.audience,
    goal: "建立专业信任",
    materialIds: enabledIds.length > 0 ? enabledIds.slice(0, 5) : [],
    bannedExtra: "",
    ...overrides,
  };
}

export function buildHarnessForTopic(
  voice: PublishVoice,
  materials: MaterialItem[],
  topic: Pick<Topic, "section" | "contentGoal" | "targetAudience">
): GenerationHarness {
  return buildHarnessFromVoice(voice, materials, {
    section: topic.section as ContentSection,
    audienceFocus: topic.targetAudience || voice.audience,
    goal: topic.contentGoal as ContentGoal,
  });
}
