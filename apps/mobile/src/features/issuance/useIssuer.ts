import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IssuerOverview,
  RiderDetail,
  RiderInput,
  RiderList,
  RiderQuery,
} from '@deligate/validation';
import { ApiRequestError } from '@/lib/api/errors';
import { issuerApi } from './issuer.api';

export function useIssuer(selectedRiderId?: string) {
  const [list, setList] = useState<RiderList | null>(null);
  const [overview, setOverview] = useState<IssuerOverview | null>(null);
  const [detail, setDetail] = useState<RiderDetail | null>(null);
  const [query, setQuery] = useState<RiderQuery>({ page: 1, limit: 20, search: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityVersion, setActivityVersion] = useState(0);
  const generation = useRef(0);
  const running = useRef(false);

  const load = useCallback(async () => {
    const [nextList, nextOverview] = await Promise.all([
      issuerApi.list(query),
      issuerApi.overview(),
    ]);
    return { nextList, nextOverview };
  }, [query]);

  useEffect(() => {
    let active = true;
    setList(null);
    setError(null);
    void load()
      .then(({ nextList, nextOverview }) => {
        if (active) {
          setList(nextList);
          setOverview(nextOverview);
        }
      })
      .catch(() => {
        if (active) setError('Rider records could not be loaded. Refresh to try again.');
      });
    return () => {
      active = false;
    };
  }, [load]);

  const run = useCallback(async (work: () => Promise<void>) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'The operation could not be completed. Refresh the saved state.',
      );
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  const select = useCallback(
    (id: string) =>
      run(async () => {
        const selected = generation.current + 1;
        generation.current = selected;
        setDetail(null);
        const next = await issuerApi.detail(id);
        if (generation.current === selected) setDetail(next);
      }),
    [run],
  );

  const refreshList = () =>
    run(async () => {
      const { nextList, nextOverview } = await load();
      setList(nextList);
      setOverview(nextOverview);
      setActivityVersion((value) => value + 1);
    });

  const save = (input: RiderInput, id?: string) =>
    run(async () => {
      const rider = await issuerApi.save(input, id);
      generation.current += 1;
      setDetail(await issuerApi.detail(rider.id));
      const { nextList, nextOverview } = await load();
      setList(nextList);
      setOverview(nextOverview);
    });

  const action = useCallback(
    (command: 'issuance' | 'refresh' | 'revoke') =>
      run(async () => {
        if (!detail) return;
        const selected = generation.current;
        try {
          const next = await issuerApi.action(detail.rider.id, command);
          if (generation.current === selected) setDetail(next);
        } catch (cause) {
          // The command may have persisted a failure/uncertain state before returning an error.
          const saved = await issuerApi.detail(detail.rider.id);
          if (generation.current === selected) setDetail(saved);
          throw cause;
        }
        const { nextList, nextOverview } = await load();
        setList(nextList);
        setOverview(nextOverview);
        setActivityVersion((value) => value + 1);
      }),
    [detail, load, run],
  );

  useEffect(() => {
    if (selectedRiderId) void select(selectedRiderId);
  }, [selectedRiderId, select]);

  return {
    list,
    overview,
    detail,
    query,
    setQuery,
    busy,
    error,
    activityVersion,
    select,
    save,
    action,
    refreshList,
  };
}
