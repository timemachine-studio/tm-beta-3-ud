/**
 * TimeMachine Contour - Hash Generator Module
 *
 * Generates MD5, SHA-1, SHA-256, and SHA-512 hashes using Web Crypto API.
 * MD5 is implemented in pure JS since Web Crypto doesn't support it.
 */

export interface HashResult {
  input: string;
  sha256?: string;
  sha1?: string;
  sha512?: string;
  md5?: string;
  isLoading: boolean;
  error?: string;
  isPartial: boolean;
}

// Simple MD5 implementation (pure JS)
function md5(str: string): string {
  function rotateLeft(val: number, shift: number) {
    return (val << shift) | (val >>> (32 - shift));
  }

  function addUnsigned(x: number, y: number) {
    const result = (x & 0x7FFFFFFF) + (y & 0x7FFFFFFF);
    if ((x & 0x80000000) ^ (y & 0x80000000)) {
      return result ^ 0x80000000;
    }
    if ((x & 0x80000000) & (y & 0x80000000)) {
      return result ^ 0x80000000;
    }
    return result;
  }

  function f(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function g(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function h(x: number, y: number, z: number) { return x ^ y ^ z; }
  function ii(x: number, y: number, z: number) { return y ^ (x | ~z); }

  function transform(func: (a: number, b: number, c: number) => number, a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(func(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  // Convert string to word array
  const msgLen = str.length;
  const wordCount = (((msgLen + 8) >>> 6) + 1) * 16;
  const words = new Array(wordCount).fill(0);

  for (let i = 0; i < msgLen; i++) {
    words[i >>> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
  }
  words[msgLen >>> 2] |= 0x80 << ((msgLen % 4) * 8);
  words[wordCount - 2] = msgLen * 8;

  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;

  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000));
  const K = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12,
    5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2,
    0, 7, 14, 5, 12, 3, 10, 1, 8, 15, 6, 13, 4, 11, 2, 9,
  ];
  const funcs = [f, g, h, ii];

  for (let i = 0; i < wordCount; i += 16) {
    let aa = a, bb = b, cc = c, dd = d;

    for (let j = 0; j < 64; j++) {
      const round = j >>> 4;
      const sIdx = round * 4 + (j % 4);
      a = transform(funcs[round], a, b, c, d, words[i + K[j]], S[sIdx], T[j]);
      const temp = d; d = c; c = b; b = a; a = temp;
    }

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  function toHex(n: number) {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ((n >>> (i * 8)) & 0xFF).toString(16).padStart(2, '0');
    }
    return s;
  }

  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

async function sha(algorithm: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createHashResult(input: string): HashResult {
  if (!input.trim()) {
    return { input, isLoading: false, isPartial: true };
  }
  return { input, md5: md5(input), isLoading: true, isPartial: false };
}

export async function resolveHash(result: HashResult): Promise<HashResult> {
  if (result.isPartial || !result.input.trim()) return result;
  try {
    const [sha1, sha256, sha512] = await Promise.all([
      sha('SHA-1', result.input),
      sha('SHA-256', result.input),
      sha('SHA-512', result.input),
    ]);
    return { ...result, sha1, sha256, sha512, isLoading: false };
  } catch {
    return { ...result, error: 'Failed to generate hashes', isLoading: false };
  }
}
