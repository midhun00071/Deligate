import { useEffect, useRef, useState } from 'react';
import type { CredentialRecord } from '@deligate/validation';
import { shouldPollCredential } from './credentialPresentation';

export function useIssuancePolling(
  credential: CredentialRecord | null | undefined,
  refresh: () => Promise<boolean>,
) {
  const [stopped, setStopped] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const id = credential?.id;
  const pending = shouldPollCredential(credential);

  useEffect(() => {
    setStopped(false);
    if (!id || !pending) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      const ok = await refreshRef.current();
      if (cancelled) return;
      if (!ok || attempts >= 24) {
        setStopped(true);
        return;
      }
      timer = setTimeout(() => void tick(), 5000);
    };
    timer = setTimeout(() => void tick(), 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, pending]);
  return stopped;
}
