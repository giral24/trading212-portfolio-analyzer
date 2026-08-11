import { describe, expect, it } from 'vitest';

import { getEnv } from '../../src/lib/env';

describe('server environment', () => {
  it('rejects a public Trading 212 secret', () => {
    expect(() => getEnv({ DATABASE_URL: 'postgres://local', NEXT_PUBLIC_T212_API_SECRET: 'x' })).toThrow(
      'Trading 212 credentials must never use NEXT_PUBLIC_ variables.',
    );
  });

  it('requires a database URL only when the server environment is read', () => {
    expect(() => getEnv({})).toThrow('DATABASE_URL is required');
  });
});
