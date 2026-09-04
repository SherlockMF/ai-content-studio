/** Safe non-empty string check; never throws on undefined/null. */
export function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}
