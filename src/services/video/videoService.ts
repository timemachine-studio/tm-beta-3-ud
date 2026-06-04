interface VideoGenerationParams {
  prompt: string;
  inputImageUrls?: string[];
  duration?: number;
}

const POLLINATIONS_VIDEO_MODEL = 'ltx-2';
const DEFAULT_VIDEO_DURATION = 5;

export function generateVideoUrl({
  prompt,
  inputImageUrls,
  duration = DEFAULT_VIDEO_DURATION,
}: VideoGenerationParams): string {
  const encodedPrompt = encodeURIComponent(prompt.trim());
  const url = new URL(`https://gen.pollinations.ai/video/${encodedPrompt}`);

  url.searchParams.set('model', POLLINATIONS_VIDEO_MODEL);
  url.searchParams.set('duration', String(duration));

  let videoUrl = url.toString();
  const referenceImage = inputImageUrls?.find(imageUrl => imageUrl.trim());

  if (referenceImage) {
    videoUrl += `&image=${referenceImage}`;
  }

  return videoUrl;
}

export function createVideoMarkdown(params: VideoGenerationParams): string {
  return `[Generated Video](${generateVideoUrl(params)})`;
}
