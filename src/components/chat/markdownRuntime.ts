export function isMarkdownCodeComplete(
  cleanContent: string,
  code: string,
  isStreamingActive: boolean,
): boolean {
  if (!isStreamingActive) return true;
  const index = cleanContent.lastIndexOf(code);
  if (index === -1) return false;
  return cleanContent.substring(index + code.length).includes('```');
}
