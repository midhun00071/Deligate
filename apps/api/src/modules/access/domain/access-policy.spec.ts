import { ConflictException } from '@nestjs/common';
import {
  assertAccessWindowActive,
  createAccessWindow,
  TEMPORARY_ACCESS_DURATION_MS,
} from './access-policy';

describe('temporary access policy', () => {
  it('uses server time for the fixed short-lived access window', () => {
    const now = new Date('2026-09-21T12:00:00.000Z');
    const window = createAccessWindow(now);
    expect(Date.parse(window.validUntil) - Date.parse(window.validFrom)).toBe(
      TEMPORARY_ACCESS_DURATION_MS,
    );
    expect(() =>
      assertAccessWindowActive(window.validUntil, new Date('2026-09-21T12:29:59.999Z')),
    ).not.toThrow();
    expect(() =>
      assertAccessWindowActive(window.validUntil, new Date('2026-09-21T12:30:00.000Z')),
    ).toThrow(ConflictException);
  });
});
