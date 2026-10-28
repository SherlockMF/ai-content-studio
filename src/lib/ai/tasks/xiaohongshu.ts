import { getLLMProvider } from "@/lib/ai/providers";
import { xiaohongshuOutlineSchema, xiaohongshuOutputSchema } from "@/lib/ai/schemas";
import { runXiaohongshuTwoPassConversion } from "@/lib/ai/xiaohongshu-conversion";
import { buildXiaohongshuConversionPrompt, buildXiaohongshuOutlinePrompt } from "@/lib/ai/xiaohongshu-prompt";
import type { PublishVoice, XiaohongshuGenerationResult, XiaohongshuOutline } from "@/types/domain";
import { buildTaskMessages, type WithLLM } from "./shared";

export async function generateXiaohongshuArticle(
  input: {
    voice: PublishVoice;
    sourceContent: {
      id: string;
      title: string;
      digest?: string;
      body: string;
      cta?: string;
      supplementaryNotes?: string;
    };
  } & WithLLM
): Promise<XiaohongshuGenerationResult> {
  const provider = getLLMProvider(input.llm);
  const voiceForPrompt = { ...input.voice, conversionNote: undefined };
  const history = { materials: [] as string[], historyTitles: [input.sourceContent.title] };

  return runXiaohongshuTwoPassConversion({
    sourceContent: input.sourceContent,
    voice: input.voice,
    extractOutline: async () => {
      const messages = buildTaskMessages(
        voiceForPrompt,
        null,
        history,
        buildXiaohongshuOutlinePrompt(input.sourceContent)
      );
      return provider.generateStructuredOutput<XiaohongshuOutline>(messages, xiaohongshuOutlineSchema);
    },
    writeArticle: async (outline) => {
      const messages = buildTaskMessages(
        voiceForPrompt,
        null,
        history,
        buildXiaohongshuConversionPrompt({ ...input.sourceContent, outline })
      );
      return provider.generateStructuredOutput(messages, xiaohongshuOutputSchema);
    },
  });
}
