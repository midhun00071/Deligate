import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { RiderList, RiderQuery } from '@deligate/validation';
import { Button, Card, Field, StatusBadge } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/states';
import { colors, spacing, type } from '@/theme/tokens';
import { useState } from 'react';

export function RiderRegistry({
  list,
  query,
  busy,
  onQuery,
  onSelect,
}: {
  list: RiderList | null;
  query: RiderQuery;
  busy: boolean;
  onQuery: (query: RiderQuery) => void;
  onSelect: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const table = Platform.OS === 'web' && width >= 1000;
  const [search, setSearch] = useState(query.search);
  return (
    <Card>
      <View style={styles.controls}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Field
            label="Search employee reference"
            value={search}
            maxLength={64}
            onChangeText={setSearch}
            onSubmitEditing={() => onQuery({ ...query, search, page: 1 })}
          />
        </View>
        <Button
          label="Search"
          disabled={busy}
          variant="secondary"
          onPress={() => onQuery({ ...query, search, page: 1 })}
        />
      </View>
      <View style={styles.controls}>
        {(['ALL', 'ACTIVE', 'SUSPENDED', 'INACTIVE'] as const).map((status) => (
          <Button
            key={status}
            label={status}
            disabled={busy}
            variant={(query.status ?? 'ALL') === status ? 'primary' : 'ghost'}
            onPress={() =>
              onQuery({ ...query, status: status === 'ALL' ? undefined : status, page: 1 })
            }
          />
        ))}
      </View>
      {table ? (
        <View style={styles.row}>
          <Text style={styles.cell}>EMPLOYEE REFERENCE</Text>
          <Text style={styles.cell}>EMPLOYMENT</Text>
          <Text style={styles.cell}>CREDENTIAL</Text>
          <Text style={styles.cell}>CREATED</Text>
        </View>
      ) : null}
      {!list ? (
        <LoadingState label="Loading rider records" />
      ) : list.riders.length === 0 ? (
        <EmptyState
          title="No matching riders"
          description="Create a rider or change the search filters."
        />
      ) : (
        list.riders.map((rider) => (
          <Pressable
            key={rider.id}
            accessibilityRole="button"
            accessibilityLabel={`View rider ${rider.employeeReference}`}
            disabled={busy}
            onPress={() => onSelect(rider.id)}
            style={[styles.row, !table && styles.cardRow]}
          >
            <Text style={[styles.cell, { color: colors.ink, fontWeight: '600' }]}>
              {rider.employeeReference || 'Unassigned reference'}
            </Text>
            <View style={{ flex: 1 }}>
              <StatusBadge label={rider.employmentStatus} tone="muted" />
            </View>
            <Text style={styles.cell}>
              {rider.credentialState?.replaceAll('_', ' ') ?? 'Not issued'}
              {rider.credentialSource === 'mock' ? ' · Simulation' : ''}
            </Text>
            <Text style={styles.cell}>{new Date(rider.createdAt).toLocaleDateString()}</Text>
          </Pressable>
        ))
      )}
      <View style={styles.controls}>
        <Button
          label="Previous"
          variant="secondary"
          disabled={busy || query.page <= 1}
          onPress={() => onQuery({ ...query, page: query.page - 1 })}
        />
        <Text style={type.small}>
          Page {query.page} · {list?.total ?? '—'} riders
        </Text>
        <Button
          label="Next"
          variant="secondary"
          disabled={busy || !list || query.page * query.limit >= list.total}
          onPress={() => onQuery({ ...query, page: query.page + 1 })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  cardRow: { flexDirection: 'column', paddingVertical: spacing.md },
  cell: { ...type.small, flex: 1 },
});
