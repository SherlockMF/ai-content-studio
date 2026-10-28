import { toast } from "sonner";

export async function copyWithToast(
  text: string,
  successMessage: string,
  failureMessage = "复制失败，请检查剪贴板权限"
) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : failureMessage);
    return false;
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // 立即 revoke 在部分浏览器会中断下载
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
