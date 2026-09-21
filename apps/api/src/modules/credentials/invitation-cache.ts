import { Injectable } from '@nestjs/common';
import { validateIssuerInvitation } from '@deligate/eidstack';

/** Ephemeral handoff only, never persisted or logged. TTL is local retention, not wallet expiry. */
@Injectable()
export class InvitationCache {
  private readonly entries = new Map<string, { value: string; until: number }>();
  put(id: string, value: string): void {
    this.entries.set(id, {
      value: validateIssuerInvitation(value),
      until: Date.now() + 15 * 60 * 1000,
    });
    if (this.entries.size > 500) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }
  }
  get(id: string): string | undefined {
    const entry = this.entries.get(id);
    if (!entry || Date.now() >= entry.until) {
      this.entries.delete(id);
      return undefined;
    }
    return entry.value;
  }
  remove(id: string): void {
    this.entries.delete(id);
  }
}
