import { Injectable } from '@nestjs/common';

/** Invitations are ephemeral handoff data, never database fields. */
@Injectable()
export class VerificationInvitationCache {
  private readonly values = new Map<string, { value: string; expiresAt: number }>();

  put(sessionId: string, invitation: string): void {
    this.values.set(sessionId, { value: invitation, expiresAt: Date.now() + 15 * 60_000 });
  }

  get(sessionId: string): string | undefined {
    const saved = this.values.get(sessionId);
    if (!saved || saved.expiresAt <= Date.now()) {
      this.values.delete(sessionId);
      return undefined;
    }
    return saved.value;
  }

  remove(sessionId: string): void {
    this.values.delete(sessionId);
  }
}
