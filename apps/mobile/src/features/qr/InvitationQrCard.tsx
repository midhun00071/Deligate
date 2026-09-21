import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ErrorState, LoadingState } from '@/components/states';
import { Button, Card, StatusBadge } from '@/components/ui';
import { colors, spacing, type } from '@/theme/tokens';

import type { ValidatedInvitation } from './invitation';

interface InvitationQrCardProps {
  invitation?: ValidatedInvitation;
  pending?: boolean;
  error?: string;
}

export function InvitationQrCard({ invitation, pending, error }: InvitationQrCardProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (pending) {
    return (
      <Card>
        <LoadingState label="Preparing invitation" />
      </Card>
    );
  }

  if (error || !invitation) {
    return (
      <ErrorState
        title="Invitation unavailable"
        description={error ?? 'The server did not provide a safe invitation to display.'}
      />
    );
  }

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(invitation.value);
      setFeedback('Invitation copied exactly.');
    } catch {
      setFeedback('Copying is unavailable. Select the invitation text to copy it.');
    }
  };

  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & {
          share?: (data: ShareData) => Promise<void>;
        };

        if (!nav.share) {
          setFeedback('Sharing is unavailable in this browser.');
          return;
        }

        await nav.share({ text: invitation.value });
      } else {
        await Share.share({ message: invitation.value });
      }

      setFeedback('Invitation shared exactly.');
    } catch {
      setFeedback('Sharing was cancelled or unavailable.');
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <View>
          <Text style={type.title}>Wallet invitation</Text>
          <Text style={type.small}>Scan this code with the external holder wallet.</Text>
        </View>
        <StatusBadge
          label={invitation.source === 'mock' ? 'Sandbox simulation' : 'Live source'}
          tone={invitation.source === 'mock' ? 'muted' : 'neutral'}
        />
      </View>

      <View accessibilityLabel="Invitation QR code" style={styles.qr}>
        <QRCode
          backgroundColor={colors.background}
          color={colors.ink}
          size={220}
          value={invitation.value}
        />
      </View>

      <Text selectable numberOfLines={3} style={styles.value}>
        {invitation.value}
      </Text>

      <View style={styles.actions}>
        <Button label="Copy invitation" variant="secondary" onPress={() => void copy()} />
        <Button label="Share" variant="secondary" onPress={() => void share()} />
      </View>

      {feedback ? (
        <Text accessibilityLiveRegion="polite" style={type.small}>
          {feedback}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  qr: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  value: {
    ...type.mono,
    backgroundColor: colors.muted,
    padding: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
});
