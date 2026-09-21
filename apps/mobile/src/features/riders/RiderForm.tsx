import { useState } from 'react';
import { Text, View } from 'react-native';
import { riderInputSchema, type Rider, type RiderInput } from '@deligate/validation';
import { Button, Dialog, Field } from '@/components/ui';
import { spacing, type } from '@/theme/tokens';

export function RiderForm({
  rider,
  busy,
  onSave,
  onDismiss,
}: {
  rider?: Rider;
  busy: boolean;
  onSave: (input: RiderInput) => Promise<boolean>;
  onDismiss: () => void;
}) {
  const [reference, setReference] = useState(rider?.employeeReference ?? '');
  const [status, setStatus] = useState<RiderInput['employmentStatus']>(
    rider?.employmentStatus ?? 'ACTIVE',
  );
  const [error, setError] = useState('');
  const submit = async () => {
    const parsed = riderInputSchema.safeParse({
      employeeReference: reference,
      employmentStatus: status,
    });
    if (!parsed.success) {
      setError('Use a reference of 1–64 letters, numbers, spaces, dots, hyphens or underscores.');
      return;
    }
    if (await onSave(parsed.data)) onDismiss();
    else setError('Save failed. Check the connection and try again.');
  };
  return (
    <Dialog
      visible
      title={rider ? 'Edit rider record' : 'Create rider'}
      onDismiss={() => {
        if (!busy) onDismiss();
      }}
    >
      <View style={{ gap: spacing.md }}>
        <Field
          label="Employee reference"
          value={reference}
          maxLength={64}
          onChangeText={setReference}
          hint="Use an internal reference. Do not enter a national ID or contact details."
          error={error}
        />
        <Text style={type.small}>Application employment status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {(['ACTIVE', 'SUSPENDED', 'INACTIVE'] as const).map((value) => (
            <Button
              key={value}
              label={value}
              variant={value === status ? 'primary' : 'secondary'}
              disabled={busy}
              onPress={() => setStatus(value)}
            />
          ))}
        </View>
        {rider ? (
          <Text style={type.small}>
            Editing this record does not change or revoke an existing wallet credential.
          </Text>
        ) : null}
        <Button
          label={busy ? 'Saving…' : 'Save rider'}
          disabled={busy}
          onPress={() => void submit()}
        />
      </View>
    </Dialog>
  );
}
