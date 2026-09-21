import type { AppRole } from '@deligate/types';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/states';
import {
  Card,
  ListRow,
  MetricCard,
  Screen,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { AppShell } from '@/features/navigation';
import { InvitationQrCard } from '@/features/qr';
import { spacing, type } from '@/theme/tokens';

const copy: Record<AppRole, { title: string; description: string; empty: string }> = {
  DELIVERY_ADMIN: {
    title: 'Delivery operations',
    description: 'Manage rider records and credential lifecycle work from one precise workspace.',
    empty: 'No rider operations have started. Issuance workflow becomes available in the next delivery bundle.',
  },
  BUILDING_SECURITY: {
    title: 'Building security',
    description: 'Prepare minimal access-verification work at the security desk.',
    empty: 'No verification requests have started. The proof workflow becomes available in the security bundle.',
  },
  RIDER: {
    title: 'Rider companion',
    description: 'A privacy-safe account view only. Credentials remain in the external holder wallet.',
    empty: 'There is no application status to show yet. Use the external holder wallet for credential and proof actions.',
  },
};

export function RoleHomeScreen({ role }: { role: AppRole }) {
  const content = copy[role];

  return (
    <AppShell role={role}>
      <Screen safeEdges={['bottom']}>
        <SectionHeader
          action={<StatusBadge label="Sandbox" tone="muted" />}
          description={content.description}
          eyebrow="Workspace"
          title={content.title}
        />

        <View style={styles.metrics}>
          <MetricCard label="Open work" value="—" detail="No live workflow data loaded" />
          <MetricCard label="Service state" value="Ready" detail="Workspace shell is available" />
          <MetricCard
            label="Source mode"
            value="Sandbox"
            detail="Simulation is visibly labeled"
          />
        </View>

        <Card style={styles.card}>
          <Text style={type.eyebrow}>Operational queue</Text>
          <ListRow
            title="No live records loaded"
            detail="This shell intentionally does not fabricate workflow results."
          />
        </Card>

        <EmptyState title="Nothing to action yet" description={content.empty} />

        <View style={styles.preview}>
          <Text style={type.eyebrow}>Invitation renderer</Text>
          <Text style={type.small}>
            A QR code will appear only after the server supplies a validated invitation.
          </Text>
          <InvitationQrCard pending />
        </View>
      </Screen>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  preview: {
    gap: spacing.sm,
  },
});
