import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
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

type QuickActionProps = {
  title: string;
  detail: string;
  accent: string;
  tone?: 'default' | 'accent' | 'info' | 'warning' | 'danger';
  onPress: () => void;
};

function QuickAction({
  accent,
  detail,
  onPress,
  title,
  tone = 'default',
}: QuickActionProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionTile, pressed ? styles.actionTilePressed : null]}>
      <SurfaceCard padding="lg" style={styles.actionTileCard} tone={tone}>
        <View style={styles.actionTileInner}>
          <View style={styles.actionAccent}>
            <Text style={styles.actionAccentText}>{accent}</Text>
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionDetail}>{detail}</Text>
          </View>
          <Text style={styles.actionArrow}>{'>'}</Text>
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          actions={
            <>
              <PrimaryButton
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  markActivity();
                  void handleExport();
                }}
                title={isExporting ? 'Exporting...' : 'Export CSV'}
                variant="success"
              />
              <PrimaryButton
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  logout();
                }}
                title="Admin Logout"
                variant="neutral"
              />
            </>
          }
          badgeLabel="Ready"
          badgeTone="success"
          subtitle="Manage employees, logs, payroll reporting, and kiosk settings from one control surface."
          title="Admin Dashboard"
        />

        <View style={[styles.summaryRow, isCompactWidth ? styles.summaryRowCompact : null]}>
          <StatCard
            label="Active Employees"
            marker="EMP"
            subtitle={`of ${summary.totalEmployees} total`}
            tone="accent"
            value={String(summary.activeEmployees)}
          />
          <StatCard
            label="Clock Events"
            marker="LOG"
            subtitle="Total recorded"
            tone="info"
            value={String(summary.totalEvents)}
          />
          <StatCard
            label="System Status"
            marker={isLoadingSummary ? '...' : 'OK'}
            subtitle={isLoadingSummary ? 'Refreshing summary data' : 'Kiosk operational'}
            tone={isLoadingSummary ? 'info' : 'accent'}
            value={isLoadingSummary ? 'Loading' : 'Ready'}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {isLoadingSummary ? <ActivityIndicator color={colors.primary} size="small" /> : null}
        </View>

        <View style={[styles.actionsGrid, isCompactWidth ? styles.actionsGridCompact : null]}>
          <QuickAction
            accent="EMP"
            detail="Add, edit, or deactivate employee records."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminEmployees');
            }}
            title="Manage Employees"
          />
          <QuickAction
            accent="LOG"
            detail="Review clock in and out history with photos."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminLogs');
            }}
            title="View Clock Logs"
          />
          <QuickAction
            accent="PAY"
            detail="Inspect payroll periods and shift-level detail."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminPayrollHours');
            }}
            title="Payroll Hours"
          />
          <QuickAction
            accent="SET"
            detail="Configure payroll schedule and kiosk preferences."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminSettings');
            }}
            title="Settings"
          />
          <QuickAction
            accent="PIN"
            detail="Update the admin PIN used to access controls."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminChangePin');
            }}
            title="Change Admin PIN"
            tone="info"
          />
          <QuickAction
            accent="DEL"
            detail="Reset the kiosk and erase local operational data."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminDangerZone');
            }}
            title="Delete All Data"
            tone="danger"
          />
        </View>

        {feedback ? (
          <SurfaceCard padding="md" style={styles.feedbackCard} tone="info">
            <View style={styles.feedbackRow}>
              <StatusChip label="Notice" size="sm" tone="info" />
              <Text style={styles.feedback}>{feedback}</Text>
            </View>
          </SurfaceCard>
        ) : null}
      </ScrollView>
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionAccent: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  actionAccentText: {
    ...typography.eyebrow,
    color: colors.textSecondary,
  },
  actionArrow: {
    ...typography.h2,
    color: colors.textMuted,
  },
  actionDetail: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTile: {
    flexBasis: '48%',
  },
  actionTileCard: {
    minHeight: 138,
  },
  actionTileInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionTilePressed: {
    opacity: 0.94,
  },
  actionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionsGridCompact: {
    flexDirection: 'column',
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  feedback: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  feedbackCard: {
    marginTop: spacing.sm,
  },
  feedbackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryRowCompact: {
    flexDirection: 'column',
  },
});
