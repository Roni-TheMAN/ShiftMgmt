import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import TextField from '../../components/ui/TextField';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { EMPLOYEE_PIN_LENGTH } from '../../constants/app';
import { resetEmployeePin } from '../../services/repositories/employeeRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type ResetEmployeePinScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminResetEmployeePin'
>;

export default function ResetEmployeePinScreen({
  navigation,
  route,
}: ResetEmployeePinScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const { employeeId, employeeName } = route.params;
  const [mode, setMode] = useState<'RANDOM' | 'MANUAL'>('RANDOM');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    markActivity();
    setError(null);

    if (mode === 'MANUAL') {
      if (!new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(pin)) {
        setError(`PIN must be ${EMPLOYEE_PIN_LENGTH} digits.`);
        return;
      }

      if (pin !== confirmPin) {
        setError('PIN confirmation does not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const result =
        mode === 'MANUAL'
          ? await resetEmployeePin(employeeId, pin)
          : await resetEmployeePin(employeeId);

      Alert.alert('PIN Updated', `${employeeName}'s new PIN is ${result.pin}`, [
        {
          onPress: () => {
            navigation.goBack();
          },
          text: 'OK',
        },
      ]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'PIN reset failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminScrollContainer>
      <PageHeader
        onBack={() => navigation.goBack()}
        subtitle={employeeName}
        title="Reset Employee PIN"
      />

      <SurfaceCard padding="lg" style={styles.card}>
        <Text style={styles.label}>PIN Reset Type</Text>
        <View
          style={[
            styles.modeActions,
            isCompactWidth ? styles.actionsCompact : null,
            isVeryCompactWidth ? styles.actionsStacked : null,
          ]}
        >
          <PrimaryButton
            disabled={isSaving}
            fullWidth={isVeryCompactWidth}
            onPress={() => {
              markActivity();
              setError(null);
              setMode('RANDOM');
              setPin('');
              setConfirmPin('');
            }}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title="Random PIN"
            variant={mode === 'RANDOM' ? 'primary' : 'neutral'}
          />
          <PrimaryButton
            disabled={isSaving}
            fullWidth={isVeryCompactWidth}
            onPress={() => {
              markActivity();
              setError(null);
              setMode('MANUAL');
            }}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title="Set Manually"
            variant={mode === 'MANUAL' ? 'primary' : 'neutral'}
          />
        </View>

        {mode === 'MANUAL' ? (
          <>
            <TextField
              keyboardType="number-pad"
              label="New PIN"
              maxLength={EMPLOYEE_PIN_LENGTH}
              onChangeText={(value) => {
                markActivity();
                setError(null);
                setPin(value.replace(/\D/g, ''));
              }}
              placeholder="1234"
              secureTextEntry
              value={pin}
            />

            <TextField
              keyboardType="number-pad"
              label="Confirm New PIN"
              maxLength={EMPLOYEE_PIN_LENGTH}
              onChangeText={(value) => {
                markActivity();
                setError(null);
                setConfirmPin(value.replace(/\D/g, ''));
              }}
              placeholder="1234"
              secureTextEntry
              value={confirmPin}
            />
          </>
        ) : (
          <Text style={styles.helperText}>
            A random unique {EMPLOYEE_PIN_LENGTH}-digit PIN will be generated.
          </Text>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            title={isSaving ? 'Saving...' : mode === 'MANUAL' ? 'Save PIN' : 'Generate PIN'}
            variant="success"
          />
          <PrimaryButton
            fullWidth={isVeryCompactWidth}
            onPress={() => {
              navigation.goBack();
            }}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title="Cancel"
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
  helperText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
  modeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
