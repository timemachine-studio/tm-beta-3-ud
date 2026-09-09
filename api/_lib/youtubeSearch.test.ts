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

  it('preserves YouTube\'s ranking order across nesting levels', () => {
    const html = fixture({ contents: { sections: [
      { items: [
        { videoRenderer: { videoId: 'rank1', title: { simpleText: 'One' } } },
        { videoRenderer: { videoId: 'rank2', title: { simpleText: 'Two' } } },
      ] },
      { items: [{ videoRenderer: { videoId: 'rank3', title: { simpleText: 'Three' } } }] },
    ] } });

    expect(parseYouTubeSearchHtml(html).map((video) => video.videoId))
      .toEqual(['rank1', 'rank2', 'rank3']);
  });

  it('fetches the YouTube results page and applies the requested limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(fixture({ contents: [
      { videoRenderer: { videoId: 'first', title: { simpleText: 'First' } } },
      { videoRenderer: { videoId: 'second', title: { simpleText: 'Second' } } },
    ] })));

    const videos = await searchYouTubeVideos('focus & calm', 1, fetchImpl);

    // The limit keeps YouTube's top match, not whichever one the walk saw last.
    expect(videos.map((video) => video.videoId)).toEqual(['first']);
    const requestedUrl = fetchImpl.mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('search_query')).toBe('focus & calm');
  });
});
