import { describe, expect, it, vi } from 'vitest';

import firstPage from '../fixtures/trading212/history-page-one.json';
import secondPage from '../fixtures/trading212/history-page-two.json';
import { Trading212HttpError, createTrading212Client } from '../../src/server/trading212/client';

const baseUrl = 'https://demo.trading212.com/api/v0';

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { 'content-type': 'application/json', ...init.headers } });
}

describe('Trading 212 read-only adapter', () => {
  it('uses Basic authentication for a GET account summary request', async () => {
    const fetch = vi.fn().mockResolvedValue(response({}));
    const client = createTrading212Client({ baseUrl, apiKey: 'key', apiSecret: 'secret', fetch });

    await client.getSummary();

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/equity/account/summary`, expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ authorization: 'Basic a2V5OnNlY3JldA==' }),
    }));
  });

  it('uses the complete nextPagePath unchanged for the next historical page', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response(secondPage));
    const client = createTrading212Client({ baseUrl, apiKey: 'key', apiSecret: 'secret', fetch });

    const first = await client.listOrders();
    const second = await client.listOrders(first.nextPagePath ?? undefined);

    expect(second.nextPagePath).toBeNull();
    expect(fetch.mock.calls[1]?.[0]).toBe(`https://demo.trading212.com${firstPage.nextPagePath}`);
  });

  it('waits until the rate-limit reset before retrying a 429', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ error: 'limited' }, { status: 429, headers: { 'x-ratelimit-reset': '200' } }))
      .mockResolvedValueOnce(response({}));
    const client = createTrading212Client({ baseUrl, apiKey: 'key', apiSecret: 'secret', fetch, now: () => 100_000, wait });

    await client.getPositions();

    expect(wait).toHaveBeenCalledWith(100_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403])('does not retry a %i provider error or disclose credentials', async (status) => {
    const fetch = vi.fn().mockResolvedValue(response({ detail: 'secret should not appear' }, { status }));
    const client = createTrading212Client({ baseUrl, apiKey: 'key', apiSecret: 'secret', fetch });

    await expect(client.getPositions()).rejects.toEqual(expect.objectContaining<Partial<Trading212HttpError>>({ status }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('allows POST only for requesting an historical export report', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ reportId: 'sanitized-report' }));
    const client = createTrading212Client({ baseUrl, apiKey: 'key', apiSecret: 'secret', fetch });

    await client.requestExport({ dataIncluded: {} });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/equity/history/exports`, expect.objectContaining({ method: 'POST' }));
  });
});
