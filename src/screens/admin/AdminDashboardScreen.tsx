import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { exportClockEventsCsv } from '../../services/export/csvExport';
import { countClockEvents } from '../../services/repositories/clockEventRepository';
import { countEmployees } from '../../services/repositories/employeeRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type AdminDashboardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminDashboard'
>;

type SummaryState = {
  totalEmployees: number;
  activeEmployees: number;
  totalEvents: number;
};

export default function AdminDashboardScreen({
  navigation,
}: AdminDashboardScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { logout, markActivity } = useAdminSession();
  const [summary, setSummary] = useState<SummaryState>({
    activeEmployees: 0,
    totalEmployees: 0,
    totalEvents: 0,
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const [employeeSummary, eventCount] = await Promise.all([
        countEmployees(),
        countClockEvents(),
      ]);
      setSummary({
        activeEmployees: employeeSummary.active,
        totalEmployees: employeeSummary.total,
        totalEvents: eventCount,
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to load summary.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      markActivity();
      setFeedback(null);
      void loadSummary();
    }, [loadSummary, markActivity]),
  );

  const handleExport = async () => {
    markActivity();
    setFeedback(null);
    setIsExporting(true);
    try {
      const fileUri = await exportClockEventsCsv();
      setFeedback(`CSV created: ${fileUri.split('/').pop() ?? fileUri}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'CSV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.headerRow, isCompactWidth ? styles.headerRowCompact : null]}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Manage employees, logs, and kiosk settings.</Text>
          </View>
          <PrimaryButton
            fullWidth={isVeryCompactWidth}
            onPress={() => {
              logout();
            }}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactButton : undefined}
            title="Admin Logout"
            variant="neutral"
          />
        </View>

        <View style={[styles.summaryRow, isCompactWidth ? styles.summaryRowCompact : null]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Employees</Text>
            <Text style={styles.summaryValue}>
              {summary.activeEmployees} / {summary.totalEmployees}
            </Text>
            <Text style={styles.summaryHint}>Active / Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Clock Events</Text>
            <Text style={styles.summaryValue}>{summary.totalEvents}</Text>
            <Text style={styles.summaryHint}>Total recorded events</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Status</Text>
            {isLoadingSummary ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.summaryValue}>Ready</Text>
            )}
            <Text style={styles.summaryHint}>Offline local mode</Text>
          </View>
        </View>

        <View style={[styles.actionsGrid, isCompactWidth ? styles.actionsGridCompact : null]}>
          <PrimaryButton
            fullWidth
            onPress={() => {
              markActivity();
              navigation.navigate('AdminEmployees');
            }}
            title="Employees"
            variant="primary"
          />
          <PrimaryButton
            fullWidth
            onPress={() => {
              markActivity();
              navigation.navigate('AdminLogs');
            }}
            title="View Logs"
            variant="primary"
          />
          <PrimaryButton
            fullWidth
            onPress={() => {
              markActivity();
              navigation.navigate('AdminPayrollHours');
            }}
            title="Payroll Hours"
            variant="primary"
          />
          <PrimaryButton
            disabled={isExporting}
            fullWidth
            onPress={() => {
              void handleExport();
            }}
            title={isExporting ? 'Exporting...' : 'Export CSV'}
            variant="success"
          />
          <PrimaryButton
            fullWidth
            onPress={() => {
              markActivity();
              navigation.navigate('AdminSettings');
            }}
            title="Settings"
            variant="primary"
          />
          <PrimaryButton
            fullWidth
            onPress={() => {
              markActivity();
              navigation.navigate('AdminChangePin');
            }}
            title="Change Admin PIN"
            variant="neutral"
          />
          <PrimaryButton
            fullWidth
            onPress={() => {
              markActivity();
              navigation.navigate('AdminDangerZone');
            }}
            title="Delete All Data"
            variant="danger"
          />
        </View>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </ScrollView>
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionsGrid: {
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '52%',
  },
  actionsGridCompact: {
    width: '100%',
  },
  compactButton: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  feedback: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 110,
    padding: spacing.md,
  },
  summaryHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryRowCompact: {
    flexWrap: 'wrap',
  },
  summaryValue: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
