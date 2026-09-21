import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SecurityBuilding, VerificationSession } from '@deligate/validation';
import { Button, Card, Screen } from '@/components/ui';
import { InvitationQrCard, validateInvitationValue } from '@/features/qr';
import { colors, spacing, type } from '@/theme/tokens';
import { issueTemporaryAccess } from '@/features/access/api/access.api';
import { TemporaryAccessPanel } from '@/features/access/components/TemporaryAccessPanel';
import {
  createVerification,
  listSecurityBuildings,
  refreshVerification,
} from '../api/verification.api';
import { VerificationResult } from '../components/VerificationResult';

export function SecurityVerifierScreen() {
  const [buildings, setBuildings] = useState<SecurityBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>();
  const [selectedZoneId, setSelectedZoneId] = useState<string>();
  const [session, setSession] = useState<VerificationSession>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<Awaited<ReturnType<typeof issueTemporaryAccess>>>();
  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId),
    [buildings, selectedBuildingId],
  );
  useEffect(() => {
    void listSecurityBuildings()
      .then((values) => {
        setBuildings(values);
        setSelectedBuildingId(values[0]?.id);
        setSelectedZoneId(values[0]?.zones[0]?.id);
      })
      .catch(() => setError('Building choices are unavailable. Refresh and try again.'));
  }, []);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch {
      setError('This action could not be completed. Refresh before trying again.');
    } finally {
      setBusy(false);
    }
  };
  const invitation = session?.invitation
    ? validateInvitationValue(session.invitation, session.source)
    : undefined;
  return (
    <Screen>
      <View style={styles.heading}>
        <Text style={type.display}>Security verification</Text>
        <Text style={type.body}>
          Request the minimum rider proof, then let the external holder wallet review and consent.
        </Text>
      </View>
      {!session ? (
        <Card>
          <Text style={type.title}>Building</Text>
          <Text style={type.small}>Choose the building and entry zone for this verification.</Text>
          <View style={styles.options}>
            {buildings.map((building) => (
              <Button
                key={building.id}
                label={building.name}
                variant={building.id === selectedBuildingId ? 'primary' : 'secondary'}
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
                  onPress={() => setSelectedZoneId(zone.id)}
                />
              ))}
            </View>
          ) : null}
          <Button
            label="New verification"
            disabled={busy || !selectedBuildingId}
            onPress={() => {
              if (!selectedBuildingId) return;
              void run(async () =>
                setSession(
                  await createVerification({
                    buildingId: selectedBuildingId,
                    ...(selectedZoneId ? { buildingZoneId: selectedZoneId } : {}),
                  }),
                ),
              );
            }}
          />
        </Card>
      ) : null}
      {session?.decision === 'PENDING' ? (
        <>
          <InvitationQrCard invitation={invitation} pending={busy} error={error} />
          <Button
            label="Refresh verification"
            variant="secondary"
            disabled={busy}
            onPress={() => void run(async () => setSession(await refreshVerification(session.id)))}
          />
        </>
      ) : null}
      {session ? <VerificationResult session={session} /> : null}
      {session?.decision === 'ACCEPTED' && !access ? (
        <Card>
          <Text style={type.title}>Issue temporary access</Text>
          <Text style={type.body}>
            Create a 30-minute entry credential after the accepted verification.
          </Text>
          <Button
            label="Issue temporary access"
            disabled={busy}
            onPress={() => void run(async () => setAccess(await issueTemporaryAccess(session.id)))}
          />
        </Card>
      ) : null}
      {access ? <TemporaryAccessPanel access={access} /> : null}
      {error && !session ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm, marginBottom: spacing.lg },
  error: { color: colors.danger, marginTop: spacing.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.sm },
});
