import { ConflictException } from '@nestjs/common';

export const TEMPORARY_ACCESS_DURATION_MS = 30 * 60_000;

export function createAccessWindow(now = new Date()): { validFrom: string; validUntil: string } {
  return {
    validFrom: now.toISOString(),
    validUntil: new Date(now.getTime() + TEMPORARY_ACCESS_DURATION_MS).toISOString(),
  };
}

export function assertAccessWindowActive(validUntil: string, now = new Date()): void {
  if (Date.parse(validUntil) <= now.getTime())
    throw new ConflictException('This temporary access has expired');
}
