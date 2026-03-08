import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { EMPLOYEE_PIN_LENGTH } from '../../constants/app';
import {
  createEmployee,
  getEmployeeById,
  updateEmployee,
} from '../../services/repositories/employeeRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type EmployeeFormScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminEmployeeForm'
>;

export default function EmployeeFormScreen({
  navigation,
  route,
}: EmployeeFormScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const isCreateMode = route.params.mode === 'create';
  const employeeId = route.params.mode === 'edit' ? route.params.employeeId : null;
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(!isCreateMode);

  useEffect(() => {
    let mounted = true;
    const loadEmployee = async () => {
      if (!employeeId) {
        return;
      }
      setIsLoadingEmployee(true);
      try {
        const employee = await getEmployeeById(employeeId);
        if (!employee) {
          throw new Error('Employee not found.');
        }
        if (mounted) {
          setName(employee.name);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load employee.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingEmployee(false);
        }
      }
    };
    void loadEmployee();
    return () => {
      mounted = false;
    };
  }, [employeeId]);

  const saveEmployee = async () => {
    markActivity();
    setError(null);

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!isCreateMode && pin && !new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(pin)) {
      setError(`PIN must be ${EMPLOYEE_PIN_LENGTH} digits.`);
      return;
    }

    setIsSaving(true);
    try {
      if (isCreateMode) {
        const { pin: generatedPin } = await createEmployee(name);
        Alert.alert(
          'Employee Created',
          `${name.trim()} has been added.\nAssigned PIN: ${generatedPin}`,
          [
            {
              onPress: () => {
                navigation.goBack();
              },
              text: 'OK',
            },
          ],
        );
      } else if (employeeId) {
        await updateEmployee(employeeId, name, pin || undefined);
        navigation.goBack();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingEmployee) {
    return (
      <AdminScreenContainer style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScrollContainer>
      <Text style={styles.title}>{isCreateMode ? 'Add Employee' : 'Edit Employee'}</Text>
      <Text style={styles.subtitle}>
        {isCreateMode
          ? 'Create a new employee record. A unique PIN will be auto-generated.'
          : 'Update employee details and optionally set a new PIN.'}
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={(value) => {
            markActivity();
            setError(null);
            setName(value);
          }}
          placeholder="Employee Name"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={name}
        />

        {isCreateMode ? (
          <Text style={styles.helperText}>
            A random unique {EMPLOYEE_PIN_LENGTH}-digit PIN will be generated on save.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>
              New PIN ({EMPLOYEE_PIN_LENGTH} digits, optional)
            </Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={EMPLOYEE_PIN_LENGTH}
              onChangeText={(value) => {
                markActivity();
                setError(null);
                setPin(value.replace(/\D/g, ''));
              }}
              placeholder="Leave blank to keep current PIN"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={styles.input}
              value={pin}
            />
          </>
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
              void saveEmployee();
            }}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title={isSaving ? 'Saving...' : 'Save'}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  formCard: {
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
  helperText: {
    ...typography.label,
    color: colors.textSecondary,
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
