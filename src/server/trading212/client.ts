import { reportRequestSchema, reportResponseSchema, pageSchema, type Page } from './schemas';
import type { ExportRequest, ExportReport } from './exports';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type Trading212Client = {
  getSummary(): Promise<unknown>;
  getPositions(): Promise<unknown>;
  listOrders(nextPagePath?: string): Promise<Page>;
  listTransactions(nextPagePath?: string): Promise<Page>;
  listDividends(nextPagePath?: string): Promise<Page>;
  requestExport(input: ExportRequest): Promise<ExportReport>;
  listExports(): Promise<unknown>;
};

export class Trading212HttpError extends Error {
  constructor(readonly status: number) {
    super(`Trading 212 request failed with status ${status}.`);
    this.name = 'Trading212HttpError';
  }
}

type ClientOptions = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
};

const retryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

export function createTrading212Client(options: ClientOptions): Trading212Client {
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const authorization = `Basic ${Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString('base64')}`;
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const baseOrigin = new URL(baseUrl).origin;

  async function request(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
    const isEndpointPath = path.startsWith('/equity/');
    const isProviderPagePath = path.startsWith('/api/v0/equity/');
    if ((!isEndpointPath && !isProviderPagePath) || (method === 'POST' && path !== '/equity/history/exports')) {
      throw new Error('Trading 212 adapter permits only documented read endpoints and report requests.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
      let response: Response;

      try {
        response = await fetchImpl(`${isProviderPagePath ? baseOrigin : baseUrl}${path}`, {
          method,
          headers: { authorization, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timeout);
        if (attempt === 2) throw new Error('Trading 212 request failed without exposing provider details.');
        await wait(0);
        continue;
      }
      clearTimeout(timeout);

      if (response.ok) return response.json();
      if (!retryableStatus(response.status) || attempt === 2) throw new Trading212HttpError(response.status);
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      await wait(response.status === 429 && Number.isFinite(reset) ? Math.max(0, reset * 1000 - now()) : 0);
    }

    throw new Error('Trading 212 request exhausted retries.');
  }

  const list = async (path: string, nextPagePath?: string): Promise<Page> => pageSchema.parse(await request(nextPagePath ?? path));

  return {
    getSummary: () => request('/equity/account/summary'),
    getPositions: () => request('/equity/positions'),
    listOrders: (nextPagePath) => list('/equity/history/orders', nextPagePath),
    listTransactions: (nextPagePath) => list('/equity/history/transactions', nextPagePath),
    listDividends: (nextPagePath) => list('/equity/history/dividends', nextPagePath),
    requestExport: async (input) => reportResponseSchema.parse(await request('/equity/history/exports', 'POST', reportRequestSchema.parse(input))),
    listExports: () => request('/equity/history/exports'),
  };
}
