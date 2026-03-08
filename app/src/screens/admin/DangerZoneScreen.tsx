import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { DEFAULT_ADMIN_PIN } from '../../constants/app';
import { deleteAllSavedPhotos } from '../../services/camera/photoStorage';
import { deleteAllOperationalData } from '../../services/repositories/maintenanceRepository';
import { resetAdminPinToDefault } from '../../services/repositories/settingsRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type DangerZoneScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminDangerZone'
>;

export default function DangerZoneScreen({ navigation }: DangerZoneScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const performDelete = async () => {
    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      await deleteAllOperationalData();
      await deleteAllSavedPhotos();
      await resetAdminPinToDefault();
      setConfirmText('');
      setMessage(
        `All local data was deleted. Admin PIN reset to default (${DEFAULT_ADMIN_PIN}).`,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Delete operation failed.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const askForConfirmation = () => {
    markActivity();
    Alert.alert(
      'Delete All Data',
      'This permanently deletes employees, logs, and saved photos from this device.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => {
            void performDelete();
          },
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  return (
    <AdminScrollContainer>
      <Text style={styles.title}>Danger Zone</Text>
      <Text style={styles.subtitle}>
        Delete all operational data on this kiosk. This cannot be undone.
      </Text>

      <View style={styles.card}>
        <Text style={styles.warningText}>
          Type DELETE to enable the destructive action.
        </Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setMessage(null);
            setConfirmText(value.toUpperCase());
          }}
          placeholder="DELETE"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={confirmText}
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
            disabled={confirmText !== 'DELETE' || isDeleting}
            fullWidth={isVeryCompactWidth}
            onPress={askForConfirmation}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title={isDeleting ? 'Deleting...' : 'Delete All Data'}
            variant="danger"
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.lg,
    maxWidth: 700,
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
  warningText: {
    ...typography.label,
    color: colors.warning,
  },
});
