export interface VerificationDeskReset {
  clearAccess: () => void;
  clearError: () => void;
  clearProofQr: () => void;
  clearRoute: () => void;
  clearSession: () => void;
}

/** Clears only client presentation/navigation state; server history is deliberately untouched. */
export function resetVerificationDesk(reset: VerificationDeskReset): void {
  reset.clearSession();
  reset.clearAccess();
  reset.clearError();
  reset.clearProofQr();
  reset.clearRoute();
}
