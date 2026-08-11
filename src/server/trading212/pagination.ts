import type { Page } from './schemas';

/** Consumes only the provider-supplied nextPagePath; it never invents a cursor. */
export async function collectPages<T>(loadPage: (nextPagePath?: string) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  let nextPagePath: string | undefined;

  do {
    const page = await loadPage(nextPagePath);
    items.push(...page.items);
    nextPagePath = page.nextPagePath ?? undefined;
  } while (nextPagePath !== undefined);

  return items;
}
