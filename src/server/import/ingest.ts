import { createHash } from 'node:crypto';

import { normalizeEvent, type ProviderEvent } from './normalize';

export type ProviderPage = { source: string; accountId: string; items: ProviderEvent[] };
export type IngestionCounters = { created: number; ignored: number; unknown: number };

const imported = new Set<string>();

/** Temporary deterministic seam; Task 5 callers replace this with transactional raw-event upserts. */
export async function ingestPage(page: ProviderPage): Promise<IngestionCounters> {
  let created = 0;
  let ignored = 0;
  let unknown = 0;
  for (const item of page.items) {
    const event = normalizeEvent(item);
    const hash = createHash('sha256').update(JSON.stringify(event.raw)).digest('hex');
    const identity = `${page.accountId}:${page.source}:${event.externalId ?? hash}`;
    if (imported.has(identity)) { ignored += 1; continue; }
    imported.add(identity);
    created += 1;
    if (event.type === 'unknown') unknown += 1;
  }
  return { created, ignored, unknown };
}
