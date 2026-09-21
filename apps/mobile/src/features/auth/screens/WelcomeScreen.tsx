import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/states';
import { Button, Card, Field, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { roleHomePath } from '@/features/navigation';
import { colors, spacing, type } from '@/theme/tokens';

export function WelcomeScreen() {
  const { actor, signIn, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && actor) {
      router.replace(roleHomePath[actor.role] as Href);
    }
  }, [actor, router, status]);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await signIn({ email, password });
    } catch {
      setError('We could not sign you in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoiding}
    >
      <Screen
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.intro}>
            <Text style={styles.brand}>Deligate</Text>
            <Text style={styles.subtitle}>
              Privacy-preserving delivery access, designed for the operational teams that coordinate it.
            </Text>
          </View>

          <Card style={styles.card}>
            <Text style={type.title}>Sign in</Text>
            <View style={styles.form}>
              <Field
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email"
                placeholder="name@company.com"
                value={email}
                onChangeText={setEmail}
              />
              <Field
                label="Password"
                placeholder="Your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {error ? (
                <ErrorState title="Sign-in unavailable" description={error} />
              ) : null}
              <Button
                disabled={busy || !email || !password}
                fullWidth
                label={busy ? 'Signing in' : 'Sign in'}
                onPress={() => void submit()}
              />
            </View>
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
  },
  intro: {
    maxWidth: 480,
  },
  brand: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    ...type.body,
    marginTop: spacing.xs,
  },
  card: {
    maxWidth: 420,
    width: '100%',
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
