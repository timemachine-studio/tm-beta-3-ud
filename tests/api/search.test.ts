import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticatedRequestUser, searchYouTubeVideos } = vi.hoisted(() => ({
  getAuthenticatedRequestUser: vi.fn(),
  searchYouTubeVideos: vi.fn(),
}));

vi.mock('../../api/_lib/auth.js', () => ({ getAuthenticatedRequestUser }));
vi.mock('../../api/_lib/youtubeSearch.js', () => ({ searchYouTubeVideos }));

import handler from '../../api/search.js';

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    end: vi.fn(() => res),
    setHeader: vi.fn((name: string, value: string) => {
      res.headers[name] = value;
      return res;
    }),
  };
  return res;
}

describe('YouTube search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedRequestUser.mockResolvedValue({ id: 'user-1' });
  });

  it('preserves the yt-search result mapping and ten-track limit', async () => {
    searchYouTubeVideos.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        videoId: `video-${index}`,
        title: `Track ${index}`,
        author: `Artist ${index}`,
        thumbnail: `https://img.example/${index}.jpg`,
        seconds: index + 60,
      })),
    );

    const req = {
      method: 'GET',
      query: { q: 'focus music' },
      headers: {},
    };
    const res = response();

    await handler(req as never, res as never);

    expect(searchYouTubeVideos).toHaveBeenCalledWith('focus music', 10);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `video-${index}`,
        title: `Track ${index}`,
        artist: `Artist ${index}`,
        thumbnail: `https://img.example/${index}.jpg`,
        duration: index + 60,
      })),
    });
  });
});
