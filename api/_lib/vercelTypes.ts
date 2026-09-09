import type { IncomingMessage, ServerResponse } from 'node:http';

export type VercelRequestCookies = Record<string, string>;
export type VercelRequestQuery = Record<string, string | string[]>;
export type VercelRequestBody = unknown;

/**
 * The Node request contract Vercel documents for functions with helpers enabled.
 * This is local structural typing only; Vercel still supplies the runtime object.
 */
export type VercelRequest = IncomingMessage & {
  query: VercelRequestQuery;
  cookies: VercelRequestCookies;
  body: VercelRequestBody;
};

export type VercelResponse = ServerResponse & {
  send(body: unknown): VercelResponse;
  json(body: unknown): VercelResponse;
  status(statusCode: number): VercelResponse;
  redirect(url: string): VercelResponse;
  redirect(statusCode: number, url: string): VercelResponse;
};

export type VercelApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => void | Promise<void>;
