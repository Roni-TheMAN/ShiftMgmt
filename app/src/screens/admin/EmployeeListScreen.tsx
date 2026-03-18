import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAdminSession } from '../../context/AdminSessionContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import {
  listEmployees,
  setEmployeeActive,
} from '../../services/repositories/employeeRepository';
import {
  colors,
  radius,
  spacing,
  typography,
  withAlpha,
} from '../../theme';
import type { EmployeeRecord } from '../../types/database';
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

  const employeeSummary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((employee) => employee.active === 1).length;
    return {
      active,
      inactive: total - active,
      total,
    };
  }, [employees]);

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
                navigation.navigate('AdminEmployeeForm', { mode: 'create' });
              }}
              title="Add Employee"
              variant="primary"
            />
          </>
        }
        onBack={() => {
          navigation.goBack();
        }}
        subtitle="Add, edit, activate, or reset employee PINs from one organized directory."
        title="Employees"
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accents.bronze} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <SurfaceCard padding="lg" style={styles.summaryCard} tone="info">
            <View style={[styles.summaryRow, isCompactWidth ? styles.summaryRowCompact : null]}>
              <View style={styles.summaryIntro}>
                <Text style={styles.summaryEyebrow}>Directory</Text>
                <Text style={styles.summaryTitle}>Employee roster</Text>
                <Text style={styles.summarySupport}>
                  Review active team members, manage access, and issue new PINs without storing employee PINs in plaintext.
                </Text>
              </View>

              <View style={styles.summaryChips}>
                <StatusChip label={`${employeeSummary.total} Total`} tone="info" />
                <StatusChip label={`${employeeSummary.active} Active`} tone="success" />
                {employeeSummary.inactive > 0 ? (
                  <StatusChip label={`${employeeSummary.inactive} Inactive`} tone="danger" />
                ) : null}
              </View>
            </View>
          </SurfaceCard>

          {employees.length === 0 ? (
            <SurfaceCard padding="lg" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No employees yet.</Text>
              <Text style={styles.emptySubtitle}>Add an employee to start clocking events.</Text>
            </SurfaceCard>
          ) : (
            employees.map((employee) => {
              const isInactive = employee.active !== 1;

              return (
                <SurfaceCard
                  key={employee.id}
                  padding="lg"
                  style={styles.employeeCard}
                  tone={isInactive ? 'warning' : 'default'}
                >
                  <View
                    style={[
                      styles.employeeCardInner,
                      isCompactWidth ? styles.employeeCardInnerCompact : null,
                    ]}
                  >
                    <View style={styles.employeeIdentity}>
                      <View style={[styles.monogramBubble, isInactive ? styles.monogramBubbleInactive : null]}>
                        <View style={styles.monogramRing} />
                        <Text style={[styles.monogramText, isInactive ? styles.monogramTextInactive : null]}>
                          {getEmployeeMonogram(employee.name)}
                        </Text>
                      </View>

                      <View style={styles.identityTextWrap}>
                        <View style={[styles.nameRow, isVeryCompactWidth ? styles.nameRowCompact : null]}>
                          <Text numberOfLines={1} style={styles.employeeName}>
                            {employee.name}
                          </Text>
                          <StatusChip
                            label={isInactive ? 'Inactive' : 'Active'}
                            tone={isInactive ? 'danger' : 'success'}
                          />
                        </View>

                        <View style={styles.metaRow}>
                          <View style={styles.pinPill}>
                            <Text style={styles.pinLabel}>PIN Security</Text>
                            <Text style={styles.pinValue}>Hashed Only</Text>
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
                        size="sm"
                        style={isCompactWidth ? styles.employeeActionButton : undefined}
                        title="Edit"
                        variant="secondary"
                      />
                      <PrimaryButton
                        disabled={activeToggleId === employee.id}
                        fullWidth={isVeryCompactWidth}
                        onPress={() => {
                          void toggleActive(employee);
                        }}
                        size="sm"
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
                        size="sm"
                        style={isCompactWidth ? styles.employeeActionButton : undefined}
                        title="Reset PIN"
                        variant="ghost"
                      />
                    </View>
                  </View>
                </SurfaceCard>
              );
            })
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
    alignItems: 'center',
    columnGap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    rowGap: spacing.sm,
  },
  employeeActionsCompact: {
    borderTopColor: colors.borders.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    width: '100%',
  },
  employeeCard: {
    minHeight: 0,
  },
  employeeCardInner: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  employeeCardInnerCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  employeeIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    paddingRight: spacing.md,
  },
  employeeName: {
    ...typography.cardTitle,
    color: colors.text.primary,
    flexShrink: 1,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySm,
    color: colors.states.danger,
    marginTop: spacing.sm,
  },
  identityTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  monogramBubble: {
    alignItems: 'center',
    backgroundColor: colors.tints.bronze,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: 'center',
    marginRight: spacing.md,
    position: 'relative',
    width: 56,
  },
  monogramBubbleInactive: {
    backgroundColor: colors.tints.terracotta,
  },
  monogramRing: {
    borderColor: withAlpha(colors.accents.bronze, 0.28),
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    position: 'absolute',
    width: 42,
  },
  monogramText: {
    ...typography.label,
    color: colors.accents.bronze,
  },
  monogramTextInactive: {
    color: colors.accents.terracotta,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  nameRowCompact: {
    alignItems: 'flex-start',
  },
  pinLabel: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  pinPill: {
    alignItems: 'center',
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.subtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  pinValue: {
    ...typography.bodySm,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  summaryCard: {
    minHeight: 0,
  },
  summaryChips: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    maxWidth: 340,
  },
  summaryEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  summaryIntro: {
    flex: 1,
    marginRight: spacing.md,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryRowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.md,
  },
  summarySupport: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    maxWidth: 620,
  },
  summaryTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
});
