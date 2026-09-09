import { describe, expect, it, vi } from 'vitest';
import { parseYouTubeSearchHtml, searchYouTubeVideos } from './youtubeSearch.js';

const fixture = (data: unknown) => `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;

describe('YouTube search parser', () => {
  it('reads direct video renderer fields without treating accessibility titles as strings', () => {
    const html = fixture({ contents: [{ videoRenderer: {
      videoId: 'abc123',
      title: {
        accessibility: { accessibilityData: { label: 'not the title field' } },
        runs: [{ text: 'Focus ' }, { text: 'Music' }],
      },
      shortBylineText: { runs: [{ text: 'Example Artist' }] },
      lengthText: { simpleText: '1:02:03' },
      thumbnail: { thumbnails: [{ url: 'small.jpg' }, { url: 'large.jpg' }] },
    } }] });

    expect(parseYouTubeSearchHtml(html)).toEqual([{
      videoId: 'abc123',
      title: 'Focus Music',
      author: 'Example Artist',
      thumbnail: 'large.jpg',
      seconds: 3723,
    }]);
  });

  it('fetches the YouTube results page and applies the requested limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(fixture({ contents: [
      { videoRenderer: { videoId: 'first', title: { simpleText: 'First' } } },
      { videoRenderer: { videoId: 'second', title: { simpleText: 'Second' } } },
    ] })));

    const videos = await searchYouTubeVideos('focus & calm', 1, fetchImpl);

    expect(videos).toHaveLength(1);
    const requestedUrl = fetchImpl.mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('search_query')).toBe('focus & calm');
  });
});
