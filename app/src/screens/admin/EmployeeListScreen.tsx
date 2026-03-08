import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import {
  listEmployees,
  setEmployeeActive,
} from '../../services/repositories/employeeRepository';
import type { EmployeeRecord } from '../../types/database';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type EmployeeListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminEmployees'
>;

export default function EmployeeListScreen({ navigation }: EmployeeListScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeToggleId, setActiveToggleId] = useState<number | null>(null);
  const [showPins, setShowPins] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextEmployees = await listEmployees();
      setEmployees(nextEmployees);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      markActivity();
      void loadData();
    }, [loadData, markActivity]),
  );

  const toggleActive = async (employee: EmployeeRecord) => {
    markActivity();
    setActiveToggleId(employee.id);
    setError(null);
    try {
      await setEmployeeActive(employee.id, employee.active !== 1);
      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update status.');
    } finally {
      setActiveToggleId(null);
    }
  };

  return (
    <AdminScreenContainer>
      <View style={[styles.headerRow, isCompactWidth ? styles.headerRowCompact : null]}>
        <View>
          <Text style={styles.title}>Employees</Text>
          <Text style={styles.subtitle}>Add, edit, activate, or reset employee PINs.</Text>
        </View>
        <View style={styles.headerActions}>
          <PrimaryButton
            onPress={() => {
              markActivity();
              setShowPins((current) => !current);
            }}
            title={showPins ? 'Hide PINs' : 'Show PINs'}
            variant="neutral"
          />
          <PrimaryButton
            onPress={() => {
              markActivity();
              navigation.navigate('AdminEmployeeForm', { mode: 'create' });
            }}
            title="Add Employee"
            variant="success"
          />
          <PrimaryButton
            onPress={() => {
              navigation.goBack();
            }}
            title="Back"
            variant="neutral"
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {employees.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No employees yet.</Text>
              <Text style={styles.emptySubtitle}>Add an employee to start clocking events.</Text>
            </View>
          ) : (
            employees.map((employee) => (
              <View
                key={employee.id}
                style={[
                  styles.employeeCard,
                  isCompactWidth ? styles.employeeCardCompact : null,
                ]}
              >
                  <View style={[styles.employeeMeta, isCompactWidth ? styles.employeeMetaCompact : null]}>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  <Text
                    style={[
                      styles.employeeStatus,
                      { color: employee.active ? colors.success : colors.danger },
                    ]}
                  >
                    {employee.active ? 'Active' : 'Inactive'}
                  </Text>
                  <Text style={styles.employeePin}>
                    PIN:{' '}
                    {showPins
                      ? employee.pin_code ?? 'Unknown (reset PIN to reveal)'
                      : '••••'}
                  </Text>
                  </View>
                  <View
                    style={[
                      styles.employeeActions,
                      isCompactWidth ? styles.employeeActionsCompact : null,
                    ]}
                  >
                    <PrimaryButton
                      fullWidth={isVeryCompactWidth}
                      onPress={() => {
                        markActivity();
                        navigation.navigate('AdminEmployeeForm', {
                          mode: 'edit',
                          employeeId: employee.id,
                        });
                      }}
                      style={isCompactWidth ? styles.employeeActionButton : undefined}
                      title="Edit"
                      variant="primary"
                    />
                    <PrimaryButton
                      disabled={activeToggleId === employee.id}
                      fullWidth={isVeryCompactWidth}
                      onPress={() => {
                        void toggleActive(employee);
                      }}
                      style={isCompactWidth ? styles.employeeActionButton : undefined}
                      title={employee.active ? 'Deactivate' : 'Activate'}
                      variant={employee.active ? 'danger' : 'success'}
                    />
                    <PrimaryButton
                      fullWidth={isVeryCompactWidth}
                      onPress={() => {
                        markActivity();
                        navigation.navigate('AdminResetEmployeePin', {
                          employeeId: employee.id,
                          employeeName: employee.name,
                        });
                      }}
                      style={isCompactWidth ? styles.employeeActionButton : undefined}
                      title="Reset PIN"
                      variant="neutral"
                    />
                  </View>
                </View>
            ))
          )}
        </ScrollView>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  employeeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  employeeActionButton: {
    flex: 1,
  },
  employeeActionsCompact: {
    flexWrap: 'wrap',
    width: '100%',
  },
  employeeCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  employeeCardCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  employeeMeta: {
    gap: spacing.xs,
  },
  employeeMetaCompact: {
    width: '100%',
  },
  employeeName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  employeeStatus: {
    ...typography.label,
  },
  employeePin: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.xl,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
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
