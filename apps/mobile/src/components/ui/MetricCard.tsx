import { StyleSheet, Text } from 'react-native';

import { colors, type } from '@/theme/tokens';

import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={type.eyebrow}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={type.small}>{detail}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 160,
  },
  value: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '600',
    marginVertical: 8,
  },
});
