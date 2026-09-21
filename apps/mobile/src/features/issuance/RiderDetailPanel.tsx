import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { RiderDetail } from '@deligate/validation';
import { Button, Card, Dialog, StatusBadge } from '@/components/ui';
import { InvitationQrCard, validateInvitationValue } from '@/features/qr';
import { spacing, type } from '@/theme/tokens';
import { canIssueCredential, canRevoke, credentialLabel } from './credentialPresentation';

export function RiderDetailPanel({
  detail,
  busy,
  stopped,
  onEdit,
  onAction,
}: {
  detail: RiderDetail;
  busy: boolean;
  stopped: boolean;
  onEdit: () => void;
  onAction: (action: 'issuance' | 'refresh' | 'revoke') => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const record = detail.credential;
  useEffect(() => {
    if (record?.state === 'AWAITING_WALLET') setShowQr(true);
  }, [record?.state]);
  let invitation;
  try {
    if (detail.invitation && record)
      invitation = validateInvitationValue(detail.invitation, record.source);
  } catch {
    /* Show unavailable. */
  }
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={type.title}>{detail.rider.employeeReference}</Text>
        <Text style={type.small}>Rider reference: {detail.rider.id}</Text>
        <StatusBadge label={credentialLabel(record)} tone="neutral" />
        <Text style={type.body}>
          Application workflow state. This is not a cryptographic validity check.
        </Text>
        {record ? (
          <>
            <Text style={type.small}>
              {record.source === 'mock'
                ? 'Simulation: wallet completion is simulated after 10 seconds. This QR cannot issue a real credential.'
                : 'Live eidStack source'}
            </Text>
            <Text style={type.small}>
              Issued:{' '}
              {record.issuedAt ? new Date(record.issuedAt).toLocaleString() : 'Not confirmed'}
            </Text>
            <Text style={type.small}>
              Revoked:{' '}
              {record.revokedAt ? new Date(record.revokedAt).toLocaleString() : 'Not confirmed'}
            </Text>
            <Text style={type.small}>
              Validity claim until: {new Date(record.validUntil).toLocaleDateString()}
            </Text>
            {record.errorCode ? (
              <Text style={type.body}>
                Action failed ({record.errorCode}). Ask the technical operator to reconcile this
                exchange.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={type.body}>
            Issue a 90-day employment credential with opaque rider and company references.
          </Text>
        )}
        {stopped ? (
          <Text accessibilityLiveRegion="polite" style={type.body}>
            Automatic refresh stopped. The wallet outcome is still unconfirmed. Refresh manually.
          </Text>
        ) : null}
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }}
        >
          <Button label="Edit rider" variant="secondary" disabled={busy} onPress={onEdit} />
          {canIssueCredential(record) ? (
            <Button
              label={record ? 'Issue new credential' : 'Issue rider credential'}
              disabled={busy || detail.rider.employmentStatus !== 'ACTIVE'}
              onPress={() => void onAction('issuance')}
            />
          ) : null}
          {record ? (
            <Button
              label="Refresh state"
              variant="secondary"
              disabled={busy}
              onPress={() => void onAction('refresh')}
            />
          ) : null}
          {canRevoke(record) ? (
            <Button
              label="Revoke credential"
              variant="danger"
              disabled={busy}
              onPress={() => setConfirm(true)}
            />
          ) : null}
        </View>
      </Card>
      {record?.state === 'AWAITING_WALLET' ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label={showQr ? 'Hide credential QR' : 'Show QR again'}
            variant="secondary"
            disabled={busy}
            onPress={() => setShowQr((visible) => !visible)}
          />
          {showQr ? (
            <InvitationQrCard
              invitation={invitation}
              error={
                !invitation
                  ? 'The invitation is unavailable in this server session. It is not stored in the database. Contact the technical operator; do not create a duplicate offer.'
                  : undefined
              }
            />
          ) : null}
        </View>
      ) : null}
      <Dialog
        visible={confirm}
        title="Permanently revoke credential?"
        onDismiss={() => {
          if (!busy) setConfirm(false);
        }}
      >
        <Text style={type.body}>
          This revokes the credential held by the rider. Live revocation cannot be undone.
        </Text>
        <Button
          label={busy ? 'Revoking…' : 'Confirm permanent revocation'}
          variant="danger"
          disabled={busy}
          onPress={() => {
            void onAction('revoke').then(() => setConfirm(false));
          }}
        />
      </Dialog>
    </View>
  );
}
