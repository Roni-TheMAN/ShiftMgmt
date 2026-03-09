import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
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

function getEmployeeMonogram(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 2);
}

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
      <PageHeader
        actions={
          <>
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
          </>
        }
        onBack={() => {
          navigation.goBack();
        }}
        subtitle="Add, edit, activate, or reset employee PINs."
        title="Employees"
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {employees.length === 0 ? (
            <SurfaceCard padding="lg" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No employees yet.</Text>
              <Text style={styles.emptySubtitle}>Add an employee to start clocking events.</Text>
            </SurfaceCard>
          ) : (
            employees.map((employee) => (
              <SurfaceCard
                key={employee.id}
                padding="lg"
                style={[
                  styles.employeeCard,
                  isCompactWidth ? styles.employeeCardCompact : null,
                ]}
                tone={employee.active ? 'default' : 'danger'}
              >
                <View style={[styles.employeeMeta, isCompactWidth ? styles.employeeMetaCompact : null]}>
                  <View style={styles.identityRow}>
                    <View style={styles.monogramBubble}>
                      <Text style={styles.monogramText}>{getEmployeeMonogram(employee.name)}</Text>
                    </View>
                    <View style={styles.identityTextWrap}>
                      <Text style={styles.employeeName}>{employee.name}</Text>
                      <View style={styles.identityMetaRow}>
                        <StatusChip
                          label={employee.active ? 'Active' : 'Inactive'}
                          tone={employee.active ? 'success' : 'danger'}
                        />
                        <Text style={styles.employeePin}>
                          PIN: {showPins ? employee.pin_code ?? 'Unknown' : '••••'}
                        </Text>
                      </View>
                    </View>
                  </View>
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
              </SurfaceCard>
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
  employeeActionButton: {
    flex: 1,
  },
  employeeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  employeeActionsCompact: {
    flexWrap: 'wrap',
    width: '100%',
  },
  employeeCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  employeeCardCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.md,
  },
  employeeMeta: {
    flex: 1,
    marginRight: spacing.md,
  },
  employeeMetaCompact: {
    marginRight: 0,
    width: '100%',
  },
  employeeName: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  employeePin: {
    ...typography.label,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
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
  identityMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityTextWrap: {
    flex: 1,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  monogramBubble: {
    alignItems: 'center',
    backgroundColor: colors.successMuted,
    borderRadius: 22,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  monogramText: {
    ...typography.h2,
    color: colors.primary,
  },
});
