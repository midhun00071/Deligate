import { useEffect, useState } from 'react';
import type { SecurityOverview as SecurityOverviewData } from '@deligate/validation';
import { Text, View } from 'react-native';
import { Card, MetricCard } from '@/components/ui';
import { spacing, type } from '@/theme/tokens';
import { getSecurityOverview } from '../api/security-overview.api';

export function SecurityOverview({ refreshKey = 0 }: { refreshKey?: number }) {
  const [overview, setOverview] = useState<SecurityOverviewData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void getSecurityOverview()
      .then(setOverview)
      .catch(() => setError(true));
  }, [refreshKey]);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <MetricCard
          label="Pending"
          value={String(overview?.pending ?? '—')}
          detail="Proofs awaiting a decision"
        />
        <MetricCard
          label="Accepted"
          value={String(overview?.accepted ?? '—')}
          detail="Accepted verification sessions"
        />
        <MetricCard
          label="Denied"
          value={String(overview?.denied ?? '—')}
          detail="Denied verification sessions"
        />
        <MetricCard
          label="Access issued"
          value={String(overview?.issuedAccesses ?? '—')}
          detail="Temporary access offers"
        />
      </View>

      <Card>
        <Text style={type.title}>Recent security activity</Text>
        {error ? (
          <Text style={[type.small, { marginTop: spacing.xs }]}>
            Security overview is unavailable right now.
          </Text>
        ) : overview === null ? (
          <Text style={[type.small, { marginTop: spacing.xs }]}>Loading security activity…</Text>
        ) : overview.recent.length ? (
          overview.recent.map((event) => (
            <Text key={event.id} style={[type.small, { marginTop: spacing.xs }]}>
              {event.eventType.replaceAll('_', ' ').toLowerCase()} ·{' '}
              {new Date(event.createdAt).toLocaleString()}
            </Text>
          ))
        ) : (
          <Text style={[type.small, { marginTop: spacing.xs }]}>
            No verification or access activity yet.
          </Text>
        )}
      </Card>
    </View>
  );
}
