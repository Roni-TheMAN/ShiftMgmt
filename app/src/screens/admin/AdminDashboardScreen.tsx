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
import { useAdminSession } from '../../context/AdminSessionContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { exportClockEventsCsv } from '../../services/export/csvExport';
import { countClockEvents } from '../../services/repositories/clockEventRepository';
import { countEmployees } from '../../services/repositories/employeeRepository';
import {
  colors,
  radius,
  spacing,
  typography,
  withAlpha,
} from '../../theme';
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

type QuickActionTone = 'default' | 'accent' | 'info' | 'warning' | 'danger';

type QuickActionProps = {
  title: string;
  detail: string;
  accent: string;
  tone?: QuickActionTone;
  onPress: () => void;
};

const quickActionPalette: Record<
  QuickActionTone,
  { badgeBg: string; badgeText: string; surfaceTone: QuickActionTone }
> = {
  accent: {
    badgeBg: colors.tints.bronze,
    badgeText: colors.accents.bronze,
    surfaceTone: 'accent',
  },
  danger: {
    badgeBg: colors.tints.danger,
    badgeText: colors.states.danger,
    surfaceTone: 'danger',
  },
  default: {
    badgeBg: colors.backgrounds.secondary,
    badgeText: colors.text.secondary,
    surfaceTone: 'default',
  },
  info: {
    badgeBg: withAlpha(colors.accents.bronze, 0.12),
    badgeText: colors.accents.bronze,
    surfaceTone: 'info',
  },
  warning: {
    badgeBg: colors.tints.terracotta,
    badgeText: colors.accents.terracotta,
    surfaceTone: 'warning',
  },
};

function QuickAction({
  accent,
  detail,
  onPress,
  title,
  tone = 'default',
}: QuickActionProps) {
  const palette = quickActionPalette[tone];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed ? styles.actionTilePressed : null]}
    >
      <SurfaceCard padding="lg" style={styles.actionTileCard} tone={palette.surfaceTone}>
        <View style={styles.actionTileInner}>
          <View style={styles.actionTileTop}>
            <View style={[styles.actionAccent, { backgroundColor: palette.badgeBg }]}>
              <Text style={[styles.actionAccentText, { color: palette.badgeText }]}>
                {accent}
              </Text>
            </View>
            <Text style={styles.actionArrow}>{'\u203A'}</Text>
          </View>

          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionDetail}>{detail}</Text>
          </View>
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
                variant="primary"
              />
              <PrimaryButton
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  logout();
                }}
                title="Admin Logout"
                variant="secondary"
              />
            </>
          }
          badgeLabel="Ready"
          badgeTone="success"
          subtitle="Manage employees, logs, payroll reporting, and kiosk settings from one organized control surface."
          title="Admin Dashboard"
        />

        <SurfaceCard padding="lg" style={styles.summaryShell} tone="info">
          <View style={[styles.summaryTopRow, isCompactWidth ? styles.summaryTopRowCompact : null]}>
            <View style={styles.summaryIntro}>
              <Text style={styles.summaryEyebrow}>Overview</Text>
              <Text style={styles.summaryTitle}>Today&apos;s control surface</Text>
              <Text style={styles.summaryDescription}>
                Review staffing, recent activity, and operational status before moving into detail.
              </Text>
            </View>

            <View style={styles.summaryStatusWrap}>
              {isLoadingSummary ? (
                <View style={styles.summaryLoading}>
                  <ActivityIndicator color={colors.accents.bronze} size="small" />
                  <Text style={styles.summaryLoadingText}>Refreshing summary</Text>
                </View>
              ) : (
                <StatusChip label="Operational" tone="success" />
              )}
            </View>
          </View>

          <View style={[styles.summaryRow, isCompactWidth ? styles.summaryRowCompact : null]}>
            <StatCard
              label="Active Employees"
              marker="Team"
              subtitle={`of ${summary.totalEmployees} total`}
              tone="accent"
              value={String(summary.activeEmployees)}
            />
            <StatCard
              label="Clock Events"
              marker="Logs"
              subtitle="Total recorded"
              tone="info"
              value={String(summary.totalEvents)}
            />
            <StatCard
              label="System Status"
              marker={isLoadingSummary ? 'Sync' : 'Ready'}
              subtitle={isLoadingSummary ? 'Refreshing summary data' : 'Kiosk operational'}
              tone={isLoadingSummary ? 'info' : 'accent'}
              value={isLoadingSummary ? 'Loading' : 'Ready'}
            />
          </View>
        </SurfaceCard>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Actions</Text>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          {isLoadingSummary ? <StatusChip label="Updating" size="sm" tone="info" /> : null}
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
            tone="accent"
          />
          <QuickAction
            accent="LOG"
            detail="Review clock in and out history with saved photos."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminLogs');
            }}
            title="View Clock Logs"
            tone="default"
          />
          <QuickAction
            accent="PAY"
            detail="Inspect pay periods, hours, and shift-level detail."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminPayrollHours');
            }}
            title="Payroll Hours"
            tone="info"
          />
          <QuickAction
            accent="SET"
            detail="Configure payroll schedule and kiosk preferences."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminSettings');
            }}
            title="Settings"
            tone="default"
          />
          <QuickAction
            accent="PIN"
            detail="Update the admin PIN used to access controls."
            onPress={() => {
              markActivity();
              navigation.navigate('AdminChangePin');
            }}
            title="Change Admin PIN"
            tone="warning"
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
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 52,
    paddingHorizontal: spacing.sm,
  },
  actionAccentText: {
    ...typography.micro,
    textTransform: 'uppercase',
  },
  actionArrow: {
    ...typography.sectionTitle,
    color: colors.text.muted,
    lineHeight: 24,
  },
  actionDetail: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTile: {
    flexBasis: '48%',
  },
  actionTileCard: {
    minHeight: 176,
  },
  actionTileInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  actionTilePressed: {
    opacity: 0.95,
  },
  actionTileTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  actionTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
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
    gap: spacing.section,
    paddingBottom: spacing.xxl,
  },
  feedback: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  feedbackCard: {
    marginTop: spacing.xs,
  },
  feedbackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  summaryDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    maxWidth: 620,
  },
  summaryEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  summaryIntro: {
    flex: 1,
  },
  summaryLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryLoadingText: {
    ...typography.bodySm,
    color: colors.text.secondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  summaryRowCompact: {
    flexDirection: 'column',
  },
  summaryShell: {
    minHeight: 0,
  },
  summaryStatusWrap: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 150,
  },
  summaryTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  summaryTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTopRowCompact: {
    flexDirection: 'column',
    gap: spacing.md,
  },
});
