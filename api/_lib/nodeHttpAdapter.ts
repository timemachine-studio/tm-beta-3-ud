import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type {
  VercelRequest,
  VercelRequestBody,
  VercelRequestCookies,
  VercelRequestQuery,
  VercelResponse,
} from './vercelTypes.js';

// Vercel rejects Node Function request and response payloads above 4.5 MB.
export const VERCEL_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 413,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function parseVercelQuery(searchParams: URLSearchParams): VercelRequestQuery {
  const query: VercelRequestQuery = {};
  searchParams.forEach((value, key) => {
    const current = query[key];
    if (current === undefined) query[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else query[key] = [current, value];
  });
  return query;
}

export function parseVercelCookies(cookieHeader: string | undefined): VercelRequestCookies {
  if (!cookieHeader) return {};
  const cookies: VercelRequestCookies = {};
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function formBody(buffer: Buffer): Record<string, string | string[]> {
  return parseVercelQuery(new URLSearchParams(buffer.toString('utf8')));
}

export function parseVercelBody(
  method: string | undefined,
  headers: IncomingHttpHeaders,
  buffer: Buffer,
): VercelRequestBody {
  if (buffer.byteLength > VERCEL_PAYLOAD_LIMIT_BYTES) {
    throw new ApiRequestError('Request payload exceeds Vercel\'s 4.5 MB limit', 413);
  }
  if (method === 'GET' || method === 'HEAD' || buffer.byteLength === 0) return undefined;

  const contentTypeHeader = headers['content-type'];
  const contentType = (Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader)
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();

  if (contentType === 'application/json' || contentType?.endsWith('+json')) {
    try {
      return JSON.parse(buffer.toString('utf8')) as unknown;
    } catch {
      throw new ApiRequestError('Malformed JSON request body', 400);
    }
  }
  if (contentType === 'application/x-www-form-urlencoded') return formBody(buffer);
  if (contentType === 'application/octet-stream') return buffer;
  if (contentType === 'text/plain') return buffer.toString('utf8');
  return undefined;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.byteLength;
    if (received > VERCEL_PAYLOAD_LIMIT_BYTES) {
      throw new ApiRequestError('Request payload exceeds Vercel\'s 4.5 MB limit', 413);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, received);
}

export async function createVercelRequest(req: IncomingMessage, url: URL): Promise<VercelRequest> {
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > VERCEL_PAYLOAD_LIMIT_BYTES) {
    throw new ApiRequestError('Request payload exceeds Vercel\'s 4.5 MB limit', 413);
  }
  const body = await readBody(req);
  return Object.assign(req, {
    query: parseVercelQuery(url.searchParams),
    cookies: parseVercelCookies(req.headers.cookie),
    body: parseVercelBody(req.method, req.headers, body),
  });
}

export function withVercelResponseHelpers(res: ServerResponse): VercelResponse {
  const response = res as VercelResponse;
  response.status = (statusCode: number) => {
    res.statusCode = statusCode;
    return response;
  };
  response.json = (body: unknown) => {
    if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
    return response;
  };
  response.send = (body: unknown) => {
    if (Buffer.isBuffer(body)) {
      if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
      res.end(body);
    } else if (typeof body === 'object' && body !== null) {
      response.json(body);
    } else {
      res.end(body === undefined || body === null ? '' : String(body));
    }
    return response;
  };
  response.redirect = (statusOrUrl: string | number, url?: string) => {
    const statusCode = typeof statusOrUrl === 'number' ? statusOrUrl : 307;
    const location = typeof statusOrUrl === 'string' ? statusOrUrl : url;
    if (!location) throw new TypeError('redirect requires a URL');
    res.statusCode = statusCode;
    res.setHeader('Location', location);
    res.end();
    return response;
  };
  return response;
}
