import { Prisma } from '@prisma/client';

type PrismaLikeError = { code?: unknown };

export function isBillingTableMissingError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2021';
  }

  const candidate = error as PrismaLikeError;
  return candidate.code === 'P2021';
}
