import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SecurityBuilding, VerificationSession } from '@deligate/validation';
import { Button, Card, Screen } from '@/components/ui';
import { InvitationQrCard, validateInvitationValue, type ValidatedInvitation } from '@/features/qr';
import { colors, spacing, type } from '@/theme/tokens';
import { getTemporaryAccess, issueTemporaryAccess } from '@/features/access/api/access.api';
import { TemporaryAccessPanel } from '@/features/access/components/TemporaryAccessPanel';
import {
  createVerification,
  getVerification,
  listSecurityBuildings,
  refreshVerification,
} from '../api/verification.api';
import { VerificationResult } from '../components/VerificationResult';
import { SecurityOverview } from '../components/SecurityOverview';
import { ActivityCard } from '@/features/activity/ActivityCard';
import { TechnicalStatusCard } from '@/features/technical-status/TechnicalStatusCard';
import { AppShell, type WorkspaceSection } from '@/features/navigation';
import { resetVerificationDesk } from '../verification-desk';

export function SecurityVerifierScreen() {
  const params = useLocalSearchParams<{ verificationId?: string }>();
  const router = useRouter();
  const verificationId =
    typeof params.verificationId === 'string' ? params.verificationId : undefined;
  const [buildings, setBuildings] = useState<SecurityBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>();
  const [selectedZoneId, setSelectedZoneId] = useState<string>();
  const [session, setSession] = useState<VerificationSession>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<Awaited<ReturnType<typeof issueTemporaryAccess>>>();
  const [proofQrSessionId, setProofQrSessionId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('overview');
  const running = useRef(false);
  const offsets = useRef<Record<WorkspaceSection, number>>({
    overview: 0,
    workspace: 0,
    activity: 0,
  });
  const scrollRef = useRef<ScrollView>(null);
  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId),
    [buildings, selectedBuildingId],
  );

  useEffect(() => {
    void listSecurityBuildings()
      .then((values) => {
        setBuildings(values);
        setSelectedBuildingId((current) => current ?? values[0]?.id);
        setSelectedZoneId((current) => current ?? values[0]?.zones[0]?.id);
      })
      .catch(() => setError('Building choices are unavailable. Refresh and try again.'));
  }, []);

  useEffect(() => {
    if (!verificationId) return;
    let active = true;
    setError(undefined);
    setSession(undefined);
    setAccess(undefined);
    void getVerification(verificationId)
      .then(async (saved) => {
        if (!active) return;
        setSession(saved);
        if (!saved.accessPassId) return;
        try {
          const existing = await getTemporaryAccess(saved.id);
          if (active) setAccess(existing);
        } catch {
          if (active) setError('Temporary access could not be reloaded. Refresh before retrying.');
        }
      })
      .catch(() => {
        if (active)
          setError('This verification is unavailable. Create a new verification if needed.');
      });
    return () => {
      active = false;
    };
  }, [verificationId]);

  const run = async (work: () => Promise<void>) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await work();
      setRefreshKey((value) => value + 1);
      return true;
    } catch {
      setError('This action could not be completed. Refresh before trying again.');
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  let invitation: ValidatedInvitation | undefined;
  try {
    invitation = session?.invitation
      ? validateInvitationValue(session.invitation, session.source)
      : undefined;
  } catch {
    invitation = undefined;
  }

  const scrollTo = (section: WorkspaceSection) => {
    setActiveSection(section);
    scrollRef.current?.scrollTo({ animated: true, y: offsets.current[section] });
  };

  const startFreshVerificationDesk = () => {
    scrollTo('workspace');
    resetVerificationDesk({
      clearSession: () => setSession(undefined),
      clearAccess: () => setAccess(undefined),
      clearError: () => setError(undefined),
      clearProofQr: () => setProofQrSessionId(undefined),
      clearRoute: () => router.setParams({ verificationId: undefined }),
    });
  };

  const navigate = (section: WorkspaceSection) => {
    if (section === 'workspace') {
      startFreshVerificationDesk();
      return;
    }
    scrollTo(section);
  };

  const anchor = (section: WorkspaceSection) => ({
    onLayout: (event: { nativeEvent: { layout: { y: number } } }) => {
      offsets.current[section] = event.nativeEvent.layout.y;
    },
  });

  return (
    <AppShell navigation={{ activeSection, onNavigate: navigate }} role="BUILDING_SECURITY">
      <Screen scrollRef={scrollRef}>
        <View {...anchor('overview')}>
          <View style={styles.heading}>
            <Text style={type.display}>Security verification</Text>
            <Text style={type.body}>
              Request the minimum rider proof, then let the external holder wallet review and
              consent.
            </Text>
          </View>
          <SecurityOverview refreshKey={refreshKey} />
        </View>
        <View {...anchor('workspace')} style={styles.workspace}>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {!session ? (
            <Card>
              <Text style={type.title}>Building</Text>
              <Text style={type.small}>
                Choose the building and entry zone for this verification.
              </Text>
              <View style={styles.options}>
                {buildings.map((building) => (
                  <Button
                    key={building.id}
                    label={building.name}
                    variant={building.id === selectedBuildingId ? 'primary' : 'secondary'}
                    disabled={busy}
                    onPress={() => {
                      setSelectedBuildingId(building.id);
                      setSelectedZoneId(building.zones[0]?.id);
                    }}
                  />
                ))}
              </View>
              {selectedBuilding?.zones.length ? (
                <View style={styles.options}>
                  {selectedBuilding.zones.map((zone) => (
                    <Button
                      key={zone.id}
                      label={zone.name}
                      variant={zone.id === selectedZoneId ? 'primary' : 'secondary'}
                      disabled={busy}
                      onPress={() => setSelectedZoneId(zone.id)}
                    />
                  ))}
                </View>
              ) : null}
              <Button
                label={busy ? 'Creating verification…' : 'New verification'}
                disabled={busy || !selectedBuildingId}
                onPress={() => {
                  if (!selectedBuildingId) return;
                  void run(async () => {
                    const created = await createVerification({
                      buildingId: selectedBuildingId,
                      ...(selectedZoneId ? { buildingZoneId: selectedZoneId } : {}),
                    });
                    setSession(created);
                    setProofQrSessionId(created.id);
                    router.setParams({ verificationId: created.id });
                  });
                }}
              />
            </Card>
          ) : null}
          {session?.decision === 'PENDING' ? (
            <View style={styles.actions}>
              <Button
                label={proofQrSessionId === session.id ? 'Hide proof QR' : 'Show proof QR again'}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  setProofQrSessionId((shown) => (shown === session.id ? undefined : session.id))
                }
              />
              {proofQrSessionId === session.id ? (
                <InvitationQrCard
                  invitation={invitation}
                  error={
                    invitation
                      ? undefined
                      : 'The proof invitation is unavailable in this server session. It was not stored in the database.'
                  }
                />
              ) : null}
              <Button
                label={busy ? 'Refreshing verification…' : 'Refresh verification'}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void run(async () => setSession(await refreshVerification(session.id)))
                }
              />
            </View>
          ) : null}
          {session ? <VerificationResult session={session} /> : null}
          {session?.decision === 'ACCEPTED' && !access ? (
            <Card>
              <Text style={type.title}>Issue temporary access</Text>
              <Text style={type.body}>
                Create a 30-minute entry credential after the accepted verification.
              </Text>
              <Button
                label={busy ? 'Issuing temporary access…' : 'Issue temporary access'}
                disabled={busy}
                onPress={() =>
                  void run(async () => setAccess(await issueTemporaryAccess(session.id)))
                }
              />
            </Card>
          ) : null}
          {access ? <TemporaryAccessPanel access={access} /> : null}
          {session?.decision === 'DENIED' || access ? (
            <Button
              label={access ? 'Verify another rider' : 'New verification'}
              disabled={busy}
              onPress={startFreshVerificationDesk}
            />
          ) : null}
        </View>
        <View {...anchor('activity')} style={styles.statusCards}>
          <ActivityCard refreshKey={refreshKey} title="Security activity" />
          <TechnicalStatusCard />
        </View>
      </Screen>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.md },
  heading: { gap: spacing.sm, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.sm },
  statusCards: { gap: spacing.md, marginTop: spacing.lg },
  workspace: { gap: spacing.md, marginTop: spacing.lg },
});
