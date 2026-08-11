import { z } from 'zod';

export type ServerEnv = {
  databaseUrl: string;
};

type EnvironmentInput = Record<string, string | undefined>;

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

export function getEnv(input: EnvironmentInput = process.env): ServerEnv {
  const publicTrading212Variables = Object.keys(input).filter((key) => key.startsWith('NEXT_PUBLIC_T212_'));

  if (publicTrading212Variables.length > 0) {
    throw new Error('Trading 212 credentials must never use NEXT_PUBLIC_ variables.');
  }

  if (!input.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const parsed = serverEnvironmentSchema.parse(input);

  return {
    databaseUrl: parsed.DATABASE_URL,
  };
}
