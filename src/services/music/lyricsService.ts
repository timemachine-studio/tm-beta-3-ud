export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: number;
}

export interface LyricLine {
  time: number | null;
  text: string;
}

async function fetchWithTimeout(url: string, options: any = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function searchMusic(query: string): Promise<Track[]> {
  try {
    const response = await fetchWithTimeout(
      `/api/search?q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error("Local search API failed");
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

export async function getLyrics(artist: string, title: string): Promise<{ synced: boolean; lyrics: LyricLine[] } | null> {
  try {
    // Clean up artist/title names for better matching (remove feat., ft., etc.)
    const cleanArtist = artist.replace(/\s*\(feat\..*?\)/i, '').replace(/\s*ft\..*$/i, '').trim();
    const cleanTitle = title.replace(/\s*\(feat\..*?\)/i, '').replace(/\s*ft\..*$/i, '').trim();

    const response = await fetchWithTimeout(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();

    if (data.syncedLyrics) {
      return {
        synced: true,
        lyrics: parseLRC(data.syncedLyrics),
      };
    } else if (data.plainLyrics) {
      return {
        synced: false,
        lyrics: data.plainLyrics.split("\n").map((line: string) => ({
          time: null,
          text: line.trim(),
        })),
      };
    }

    return null;
  } catch (error) {
    console.error("Lyrics fetch failed:", error);
    return null;
  }
}

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d+):(\d+)\.(\d+)\](.*)/;

  lrc.split("\n").forEach((line) => {
    const match = line.match(regex);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const text = match[4].trim();

      // Convert to total seconds
      const time = minutes * 60 + seconds + ms / 100;
      if (text) {
        lines.push({ time, text });
      }
    }
  });

  return lines.sort((a, b) => (a.time || 0) - (b.time || 0));
}
