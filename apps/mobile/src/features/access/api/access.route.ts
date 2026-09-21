export function temporaryAccessPath(id: string): string {
  return `/api/security/verifications/${encodeURIComponent(id)}/access`;
}
