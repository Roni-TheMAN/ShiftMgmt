import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import TextField from '../../components/ui/TextField';
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
    <AdminScrollContainer>
      <PageHeader
        onBack={() => navigation.goBack()}
        subtitle="Use a secure 4-digit admin PIN."
        title="Change Admin PIN"
      />

      <SurfaceCard padding="lg" style={styles.card}>
        <TextField
          keyboardType="number-pad"
          label="Current PIN"
          maxLength={ADMIN_PIN_LENGTH}
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setCurrentPin(value.replace(/\D/g, ''));
          }}
          placeholder="0000"
          secureTextEntry
          value={currentPin}
        />

        <TextField
          keyboardType="number-pad"
          label="New PIN"
          maxLength={ADMIN_PIN_LENGTH}
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setNewPin(value.replace(/\D/g, ''));
          }}
          placeholder="0000"
          secureTextEntry
          value={newPin}
        />

        <TextField
          keyboardType="number-pad"
          label="Confirm New PIN"
          maxLength={ADMIN_PIN_LENGTH}
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setConfirmPin(value.replace(/\D/g, ''));
          }}
          placeholder="0000"
          secureTextEntry
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
      </SurfaceCard>
    </AdminScrollContainer>
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
    maxWidth: 720,
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
  messageText: {
    ...typography.label,
    color: colors.success,
    marginTop: spacing.md,
  },
});
