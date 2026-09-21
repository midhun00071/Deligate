import type { VerificationSession } from '@deligate/validation';
import { StyleSheet, Text, View } from 'react-native';
import { Card, StatusBadge } from '@/components/ui';
import { colors, spacing, type } from '@/theme/tokens';

export function VerificationResult({ session }: { session: VerificationSession }) {
  const accepted = session.decision === 'ACCEPTED';
  const pending = session.decision === 'PENDING';
  const label = accepted
    ? 'Entry confirmed'
    : pending
      ? 'Waiting for wallet'
      : 'Entry not confirmed';
  return (
    <Card>
      <View style={styles.header}>
        <Text style={type.title}>{label}</Text>
        <StatusBadge label={session.decision} tone={accepted || pending ? 'neutral' : 'danger'} />
      </View>
      <Evidence label="Credential check" value={session.cryptographicVerification} />
      <Evidence label="Credential status" value={session.revocation} />
      <Evidence label="Issuer trust" value={session.issuerTrust} />
      {!pending && session.reasons.length ? (
        <Text style={styles.reason}>{message(session.reasons[0])}</Text>
      ) : null}
    </Card>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={type.body}>{label}</Text>
      <Text style={type.small}>{value.replaceAll('_', ' ')}</Text>
    </View>
  );
}

function message(reason?: string): string {
  const messages: Record<string, string> = {
    PROOF_NOT_VERIFIED: 'The holder proof could not be verified.',
    CREDENTIAL_REVOKED: 'The presented credential has been revoked.',
    ISSUER_NOT_TRUSTED: 'The issuing organization is not trusted for this access decision.',
    PROOF_EXPIRED: 'The proof request expired.',
    UPSTREAM_UNAVAILABLE: 'Verification service evidence is unavailable. Do not grant entry.',
  };
  return messages[reason ?? ''] ?? 'Entry cannot be confirmed.';
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  row: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  reason: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
});
