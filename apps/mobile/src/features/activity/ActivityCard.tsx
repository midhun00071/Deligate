import { useEffect, useState } from 'react';
import type { ActivityPage } from '@deligate/validation';
import { Text } from 'react-native';
import { Card } from '@/components/ui';
import { spacing, type } from '@/theme/tokens';
import { getActivity } from './activity.api';

export function ActivityCard({
  title = 'Recent activity',
  refreshKey = 0,
}: {
  title?: string;
  refreshKey?: number;
}) {
  const [activity, setActivity] = useState<ActivityPage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void getActivity()
      .then(setActivity)
      .catch(() => setError(true));
  }, [refreshKey]);
  return (
    <Card>
      <Text style={type.title}>{title}</Text>
      {error ? (
        <Text style={[type.small, { marginTop: spacing.xs }]}>
          Activity is unavailable right now.
        </Text>
      ) : null}
      {!error && activity === null ? (
        <Text style={[type.small, { marginTop: spacing.xs }]}>Loading activity…</Text>
      ) : null}
      {!error && activity?.events.length
        ? activity.events.map((event) => (
            <Text key={event.id} style={[type.small, { marginTop: spacing.xs }]}>
              {event.action} · {event.result} · {new Date(event.createdAt).toLocaleString()}
            </Text>
          ))
        : null}
      {!error && activity && !activity.events.length ? (
        <Text style={[type.small, { marginTop: spacing.xs }]}>
          No privacy-minimal activity is available yet.
        </Text>
      ) : null}
    </Card>
  );
}
