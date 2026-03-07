import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { ADMIN_PIN_LENGTH } from '../../constants/app';
import { changeAdminPin } from '../../services/repositories/settingsRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type ChangeAdminPinScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminChangePin'
>;

export default function ChangeAdminPinScreen({
  navigation,
}: ChangeAdminPinScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    markActivity();
    setError(null);
    setMessage(null);

    if (!new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`).test(currentPin)) {
      setError(`Current PIN must be ${ADMIN_PIN_LENGTH} digits.`);
      return;
    }

    if (!new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`).test(newPin)) {
      setError(`New PIN must be ${ADMIN_PIN_LENGTH} digits.`);
      return;
    }

    if (newPin !== confirmPin) {
      setError('PIN confirmation does not match.');
      return;
    }

    setIsSaving(true);
    try {
      const didChange = await changeAdminPin(currentPin, newPin);
      if (!didChange) {
        setError('Current admin PIN is invalid.');
        return;
      }

      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setMessage('Admin PIN updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminScreenContainer>
      <Text style={styles.title}>Change Admin PIN</Text>
      <Text style={styles.subtitle}>Use a secure 4-digit admin PIN.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Current PIN</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={ADMIN_PIN_LENGTH}
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setCurrentPin(value.replace(/\D/g, ''));
          }}
          placeholder="0000"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={styles.input}
          value={currentPin}
        />

        <Text style={styles.label}>New PIN</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={ADMIN_PIN_LENGTH}
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setNewPin(value.replace(/\D/g, ''));
          }}
          placeholder="0000"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={styles.input}
          value={newPin}
        />

        <Text style={styles.label}>Confirm New PIN</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={ADMIN_PIN_LENGTH}
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setConfirmPin(value.replace(/\D/g, ''));
          }}
          placeholder="0000"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={styles.input}
          value={confirmPin}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <View
          style={[
            styles.actions,
            isCompactWidth ? styles.actionsCompact : null,
            isVeryCompactWidth ? styles.actionsStacked : null,
          ]}
        >
          <PrimaryButton
            disabled={isSaving}
            fullWidth={isVeryCompactWidth}
            onPress={() => {
              void save();
            }}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title={isSaving ? 'Saving...' : 'Save PIN'}
            variant="success"
          />
          <PrimaryButton
            fullWidth={isVeryCompactWidth}
            onPress={() => navigation.goBack()}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title="Back"
            variant="neutral"
          />
        </View>
      </View>
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionsCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.lg,
    maxWidth: 620,
    padding: spacing.lg,
    width: '100%',
  },
  compactActionButton: {
    flex: 1,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.md,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  messageText: {
    ...typography.label,
    color: colors.success,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
