import { useEffect, useState } from 'react';
import type { TechnicalStatus } from '@deligate/validation';
import { Text, View } from 'react-native';
import { Card, StatusBadge } from '@/components/ui';
import { spacing, type } from '@/theme/tokens';
import { getTechnicalStatus } from './technical-status.api';

export function TechnicalStatusCard() {
  const [status, setStatus] = useState<TechnicalStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void getTechnicalStatus()
      .then(setStatus)
      .catch(() => setError(true));
  }, []);

  const configured = status
    ? [
        status.deliveryTenantConfigured,
        status.buildingTenantConfigured,
        status.riderSchemaConfigured,
        status.riderCredentialDefinitionConfigured,
        status.accessSchemaConfigured,
        status.accessCredentialDefinitionConfigured,
      ].filter(Boolean).length
    : 0;

  const badgeLabel = error
    ? 'Unavailable'
    : status?.mode === 'mock'
      ? 'Mock'
      : status?.mode === 'live'
        ? 'Live'
        : 'Loading';

  const detail = error
    ? 'Technical status is unavailable right now.'
    : status === null
      ? 'Loading technical status…'
      : status.mode === 'mock'
        ? 'Mock adapter active. Live eidStack references are not required for this local demo.'
        : `${configured}/6 identity references configured. ${
            status.hostname ?? 'No eidStack host configured'
          }. Live response parsing: ${
            status.responseContractVerified ? 'verified' : 'CONTRACT_UNVERIFIED'
          }.`;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={type.title}>Technical status</Text>
        <StatusBadge label={badgeLabel} tone="muted" />
      </View>
      <Text style={[type.small, { marginTop: spacing.xs }]}>{detail}</Text>
    </Card>
  );
}
