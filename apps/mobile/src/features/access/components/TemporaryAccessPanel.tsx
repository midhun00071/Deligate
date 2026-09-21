import type { TemporaryAccess } from '@deligate/validation';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, StatusBadge } from '@/components/ui';
import {
  InvitationQrCard,
  validateInvitationValue,
  type ValidatedInvitation,
} from '@/features/qr';
import { spacing, type } from '@/theme/tokens';

export function TemporaryAccessPanel({ access }: { access: TemporaryAccess }) {
  const [showQr, setShowQr] = useState(Boolean(access.invitation));
  let invitation: ValidatedInvitation | undefined;
  try {
    invitation = access.invitation
      ? validateInvitationValue(access.invitation, access.source)
      : undefined;
  } catch {
    invitation = undefined;
  }
  return (
    <Card>
      <Text style={type.title}>Temporary access</Text>
      <StatusBadge label={access.status} />
      <Text style={type.body}>Scope: {access.accessScope}</Text>
      <Text style={type.small}>Valid until {new Date(access.validUntil).toLocaleString()}</Text>
      {access.status === 'ISSUED' ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            label={showQr ? 'Hide access QR' : 'Show access QR again'}
            variant="secondary"
            onPress={() => setShowQr((visible) => !visible)}
          />
          {showQr ? (
            <InvitationQrCard
              invitation={invitation}
              error={
                invitation
                  ? undefined
                  : 'The access invitation is unavailable in this server session. It was not stored in the database.'
              }
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
