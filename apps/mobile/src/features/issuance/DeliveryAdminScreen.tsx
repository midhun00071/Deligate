import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, MetricCard, Screen, SectionHeader, StatusBadge } from '@/components/ui';
import { AppShell, type WorkspaceSection } from '@/features/navigation';
import { RiderForm } from '@/features/riders/RiderForm';
import { RiderRegistry } from '@/features/riders/RiderRegistry';
import { ActivityCard } from '@/features/activity/ActivityCard';
import { TechnicalStatusCard } from '@/features/technical-status/TechnicalStatusCard';
import { spacing, type } from '@/theme/tokens';
import { RiderDetailPanel } from './RiderDetailPanel';
import { useIssuer } from './useIssuer';
import { useIssuancePolling } from './useIssuancePolling';

export function DeliveryAdminScreen() {
  const params = useLocalSearchParams<{ riderId?: string }>();
  const router = useRouter();
  const selectedRiderId = typeof params.riderId === 'string' ? params.riderId : undefined;
  const issuer = useIssuer(selectedRiderId);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('overview');
  const [form, setForm] = useState<'create' | 'edit' | null>(null);
  const offsets = useRef<Record<WorkspaceSection, number>>({
    overview: 0,
    workspace: 0,
    activity: 0,
  });
  const scrollRef = useRef<ScrollView>(null);
  const stopped = useIssuancePolling(issuer.detail?.credential, () => issuer.action('refresh'));
  const label = issuer.overview?.mode === 'live' ? 'Live' : 'Mock simulation';

  useEffect(() => {
    if (issuer.detail && selectedRiderId !== issuer.detail.rider.id) {
      router.setParams({ riderId: issuer.detail.rider.id });
    }
  }, [issuer.detail, router, selectedRiderId]);

  const navigate = (section: WorkspaceSection) => {
    setActiveSection(section);
    scrollRef.current?.scrollTo({ animated: true, y: offsets.current[section] });
  };

  const anchor = (section: WorkspaceSection) => ({
    onLayout: (event: { nativeEvent: { layout: { y: number } } }) => {
      offsets.current[section] = event.nativeEvent.layout.y;
    },
  });

  return (
    <AppShell
      navigation={{ activeSection, onNavigate: navigate }}
      role="DELIVERY_ADMIN"
      statusLabel="Sandbox"
    >
      <Screen safeEdges={['bottom']} keyboardShouldPersistTaps="handled" scrollRef={scrollRef}>
        <View style={{ gap: spacing.lg }}>
          <View {...anchor('overview')}>
            <SectionHeader
              eyebrow="Workspace"
              title="Delivery operations"
              description="Manage rider records and issue credentials to the external holder wallet."
              action={<StatusBadge label={label} tone="muted" />}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              <MetricCard
                label="Active riders"
                value={String(issuer.overview?.activeRiders ?? '—')}
                detail="Application employment records"
              />
              <MetricCard
                label="Awaiting wallet"
                value={String(issuer.overview?.awaitingWallet ?? '—')}
                detail="Offers not yet accepted"
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
          </View>

          <View {...anchor('workspace')} style={{ gap: spacing.md }}>
            {issuer.error ? (
              <Card>
                <Text accessibilityRole="alert" style={type.body}>
                  {issuer.error}
                </Text>
              </Card>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Button
                label="Create rider"
                disabled={issuer.busy}
                onPress={() => setForm('create')}
              />
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
              onSelect={(id) => router.setParams({ riderId: id })}
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
          </View>

          <View {...anchor('activity')} style={{ gap: spacing.md }}>
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
            <ActivityCard refreshKey={issuer.activityVersion} title="Delivery activity" />
            <TechnicalStatusCard />
          </View>
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
