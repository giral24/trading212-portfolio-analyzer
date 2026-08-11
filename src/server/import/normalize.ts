export type ProviderEvent = { id?: string | number; type?: string; occurredAt?: string; [key: string]: unknown };

export type NormalizedEvent = {
  externalId: string | null;
  type: string;
  occurredAt: Date | null;
  raw: ProviderEvent;
};

/** Keeps unknown provider records intact for review instead of guessing a type. */
export function normalizeEvent(event: ProviderEvent): NormalizedEvent {
  const occurredAt = typeof event.occurredAt === 'string' && !Number.isNaN(Date.parse(event.occurredAt)) ? new Date(event.occurredAt) : null;
  return { externalId: event.id === undefined ? null : String(event.id), type: typeof event.type === 'string' ? event.type : 'unknown', occurredAt, raw: event };
}
