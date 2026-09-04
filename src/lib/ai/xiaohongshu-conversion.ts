import type {
  PublishVoice,
  XiaohongshuGenerationResult,
  XiaohongshuOutline,
} from "@/types/domain";
import { withFixedXiaohongshuVisualDirection } from "@/lib/ai/xiaohongshu-prompt";

export type XiaohongshuSourceContent = {
  id: string;
  title: string;
  digest?: string;
  body: string;
  cta?: string;
  supplementaryNotes?: string;
};

export async function runXiaohongshuTwoPassConversion(input: {
  sourceContent: XiaohongshuSourceContent;
  voice: PublishVoice;
  extractOutline: () => Promise<XiaohongshuOutline>;
  writeArticle: (outline: XiaohongshuOutline) => Promise<XiaohongshuGenerationResult>;
}): Promise<XiaohongshuGenerationResult> {
  const outline = await input.extractOutline();
  const result = await input.writeArticle(outline);
  return withFixedXiaohongshuVisualDirection(result);
}
