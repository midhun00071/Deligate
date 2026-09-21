import { Injectable } from '@nestjs/common';

@Injectable()
export class AccessInvitationCache {
  private readonly values = new Map<string, { value: string; expiresAt: number }>();
  put(id: string, value: string): void {
    this.values.set(id, { value, expiresAt: Date.now() + 15 * 60_000 });
  }
  get(id: string): string | undefined {
    const saved = this.values.get(id);
    if (!saved || saved.expiresAt <= Date.now()) {
      this.values.delete(id);
      return undefined;
    }
    return saved.value;
  }
}
