import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, MetricCard, Screen, SectionHeader, StatusBadge } from '@/components/ui';
import { AppShell } from '@/features/navigation';
import { RiderForm } from '@/features/riders/RiderForm';
import { RiderRegistry } from '@/features/riders/RiderRegistry';
import { spacing, type } from '@/theme/tokens';
import { RiderDetailPanel } from './RiderDetailPanel';
import { useIssuer } from './useIssuer';
import { useIssuancePolling } from './useIssuancePolling';

export function DeliveryAdminScreen() {
  const issuer = useIssuer();
  const [form, setForm] = useState<'create' | 'edit' | null>(null);
  const stopped = useIssuancePolling(issuer.detail?.credential, () => issuer.action('refresh'));
  const mode = issuer.overview?.mode;
  const label = mode === 'mock' ? 'Mock simulation' : mode === 'live' ? 'Live' : 'Connecting';
  return (
    <AppShell role="DELIVERY_ADMIN" statusLabel={label}>
      <Screen safeEdges={['bottom']} keyboardShouldPersistTaps="handled">
        <SectionHeader
          eyebrow="Workspace"
          title="Delivery operations"
          description="Manage rider records and issue credentials to the external holder wallet."
          action={<StatusBadge label={label} tone="muted" />}
        />
        <View style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <MetricCard
              label="Active riders"
              value={String(issuer.overview?.activeRiders ?? '—')}
              detail="Application employment records"
            />
            <MetricCard
              label="Issued credentials"
              value={String(issuer.overview?.issued ?? '—')}
              detail="Last recorded issuer state"
            />
            <MetricCard
              label="Revoked credentials"
              value={String(issuer.overview?.revoked ?? '—')}
              detail="Successful revocation commands"
            />
          </View>
          {issuer.error ? (
            <Card>
              <Text accessibilityRole="alert" style={type.body}>
                {issuer.error}
              </Text>
            </Card>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Button label="Create rider" disabled={issuer.busy} onPress={() => setForm('create')} />
            <Button
              label="Refresh records"
              variant="secondary"
              disabled={issuer.busy}
              onPress={() => void issuer.refreshList()}
            />
          </View>
          <RiderRegistry
            list={issuer.list}
            query={issuer.query}
            busy={issuer.busy}
            onQuery={issuer.setQuery}
            onSelect={(id) => void issuer.select(id)}
          />
          {issuer.detail ? (
            <RiderDetailPanel
              key={issuer.detail.rider.id}
              detail={issuer.detail}
              busy={issuer.busy}
              stopped={stopped}
              onEdit={() => setForm('edit')}
              onAction={issuer.action}
            />
          ) : null}
          <Card>
            <Text style={type.title}>Recent credential activity</Text>
            {issuer.overview?.recent.length ? (
              issuer.overview.recent.map((event) => (
                <Text key={event.id} style={type.small}>
                  {event.eventType.replaceAll('_', ' ')} ·{' '}
                  {new Date(event.createdAt).toLocaleString()}
                </Text>
              ))
            ) : (
              <Text style={type.small}>No recorded credential actions.</Text>
            )}
          </Card>
        </View>
        {form ? (
          <RiderForm
            key={`${form}-${issuer.detail?.rider.id}`}
            busy={issuer.busy}
            rider={form === 'edit' ? issuer.detail?.rider : undefined}
            onDismiss={() => setForm(null)}
            onSave={(input) =>
              issuer.save(input, form === 'edit' ? issuer.detail?.rider.id : undefined)
            }
          />
        ) : null}
      </Screen>
    </AppShell>
  );
}
