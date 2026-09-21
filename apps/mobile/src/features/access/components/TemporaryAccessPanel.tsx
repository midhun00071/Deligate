import type { TemporaryAccess } from '@deligate/validation';
import { Text } from 'react-native';
import { Card, StatusBadge } from '@/components/ui';
import { InvitationQrCard, validateInvitationValue } from '@/features/qr';
import { type } from '@/theme/tokens';

export function TemporaryAccessPanel({ access }: { access: TemporaryAccess }) {
  const invitation = access.invitation
    ? validateInvitationValue(access.invitation, access.source)
    : undefined;
  return (
    <Card>
      <Text style={type.title}>Temporary access</Text>
      <StatusBadge label={access.status} />
      <Text style={type.body}>Scope: {access.accessScope}</Text>
      <Text style={type.small}>Valid until {new Date(access.validUntil).toLocaleString()}</Text>
      {invitation ? <InvitationQrCard invitation={invitation} /> : null}
    </Card>
  );
}
