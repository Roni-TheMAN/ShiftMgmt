import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAdminSession } from '../../context/AdminSessionContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import {
  ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH,
  AUTO_CLOCK_OUT_MARKER_PHOTO_PATH,
} from '../../constants/app';
import { listAuditLogs } from '../../services/repositories/auditRepository';
import { listClockEventsWithEmployee } from '../../services/repositories/clockEventRepository';
import { colors, radius, spacing, typography, withAlpha } from '../../theme';
import type { AuditLogRecord, ClockEventWithEmployee } from '../../types/database';
import type { RootStackParamList } from '../../types/navigation';

type LogsScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminLogs'>;

type ExpandedPhotoState = {
  employeeName: string;
  timestamp: string;
  uri: string;
} | null;

function humanizeTag(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatEventTitle(item: ClockEventWithEmployee) {
  if (item.type === 'IN') {
    return item.source === 'AUTO' ? 'Clock In (Auto)' : 'Clock In';
  }
  return item.source === 'AUTO' ? 'Clock Out (Auto)' : 'Clock Out';
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function summarizeAuditDetails(item: AuditLogRecord) {
  if (!item.details_json) {
    return null;
  }

  try {
    const parsed = JSON.parse(item.details_json) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .slice(0, 3)
      .map(([key, value]) => `${humanizeTag(key)}: ${String(value)}`);
    return entries.length > 0 ? entries.join(' • ') : null;
  } catch {
    return null;
  }
}

export default function LogsScreen({ navigation }: LogsScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const [events, setEvents] = useState<ClockEventWithEmployee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhotoState>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clockRows, auditRows] = await Promise.all([
        listClockEventsWithEmployee(400),
        listAuditLogs(150),
      ]);
      setEvents(clockRows);
      setAuditLogs(auditRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load logs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      markActivity();
      void loadEvents();
    }, [loadEvents, markActivity]),
  );

  const headerSummary = useMemo(() => {
    const inCount = events.filter((event) => event.type === 'IN').length;
    const outCount = events.length - inCount;
    return { auditCount: auditLogs.length, inCount, outCount };
  }, [auditLogs.length, events]);

  return (
    <AdminScreenContainer style={styles.screen}>
      <PageHeader
        actions={
          <PrimaryButton
            fullWidth={isVeryCompactWidth}
            onPress={() => {
              markActivity();
              void loadEvents();
            }}
            size="sm"
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title="Refresh"
            variant="primary"
          />
        }
        onBack={() => navigation.goBack()}
        subtitle="Review recent clock activity, admin changes, saved photo thumbnails, and edit markers."
        title="Activity Logs"
      />

      {error ? (
        <SurfaceCard padding="md" tone="danger">
          <View style={styles.messageRow}>
            <StatusChip label="Attention" size="sm" tone="danger" />
            <Text style={styles.messageText}>{error}</Text>
          </View>
        </SurfaceCard>
      ) : null}

      {isLoading ? (
        <SurfaceCard padding="lg" tone="info">
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accents.bronze} />
            <Text style={styles.loadingTitle}>Loading recent clock events</Text>
            <Text style={styles.loadingText}>
              Preparing the latest activity with employee names and photos.
            </Text>
          </View>
        </SurfaceCard>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={events}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <SurfaceCard padding="lg" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No logs found.</Text>
              <Text style={styles.emptySubtitle}>Recent clock events will appear here.</Text>
            </SurfaceCard>
          }
          ListHeaderComponent={
            <View style={styles.listHeaderStack}>
              <SurfaceCard padding="lg" style={styles.summaryCard} tone="info">
                <View style={[styles.summaryRow, isCompactWidth ? styles.summaryRowCompact : null]}>
                  <View style={styles.summaryIntro}>
                    <Text style={styles.summaryEyebrow}>Audit feed</Text>
                    <Text style={styles.summaryTitle}>Recent clock activity</Text>
                    <Text style={styles.summarySupport}>
                      Long press a saved photo to inspect it at full size. Admin changes, resets, deletes, and payroll edits now appear in the audit trail below.
                    </Text>
                  </View>

                  <View style={styles.summaryChips}>
                    <StatusChip label={`${events.length} Events`} tone="neutral" />
                    <StatusChip label={`${headerSummary.auditCount} Admin Changes`} tone="info" />
                    <StatusChip label={`${headerSummary.inCount} In`} tone="success" />
                    <StatusChip label={`${headerSummary.outCount} Out`} tone="warning" />
                  </View>
                </View>
              </SurfaceCard>
              <SurfaceCard padding="lg" style={styles.auditCard}>
                <View style={[styles.auditCardHeader, isCompactWidth ? styles.auditCardHeaderCompact : null]}>
                  <View style={styles.auditIntro}>
                    <Text style={styles.summaryEyebrow}>Admin audit</Text>
                    <Text style={styles.summaryTitle}>Configuration and edit trail</Text>
                    <Text style={styles.summarySupport}>
                      Every admin profile change, PIN reset, settings update, and payroll edit is recorded here.
                    </Text>
                  </View>
                  <StatusChip label={`${auditLogs.length} Entries`} tone="info" />
                </View>

                {auditLogs.length === 0 ? (
                  <Text style={styles.auditEmptyText}>No admin audit entries yet.</Text>
                ) : (
                  auditLogs.slice(0, 20).map((item) => {
                    const detailSummary = summarizeAuditDetails(item);
                    return (
                      <View key={item.id} style={styles.auditRow}>
                        <View style={[styles.auditRowHeader, isCompactWidth ? styles.auditRowHeaderCompact : null]}>
                          <Text style={styles.auditSummary}>{item.summary}</Text>
                          <View style={styles.auditChipRow}>
                            <StatusChip label={humanizeTag(item.entity_type)} size="sm" tone="info" />
                            <StatusChip label={humanizeTag(item.action)} size="sm" tone="neutral" />
                          </View>
                        </View>
                        <Text style={styles.auditTimestamp}>{formatTimestamp(item.created_at)}</Text>
                        {detailSummary ? (
                          <Text style={styles.auditDetails}>{detailSummary}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </SurfaceCard>
            </View>
          }
          renderItem={({ item }) => {
            const isAutoMarker = item.photo_path === AUTO_CLOCK_OUT_MARKER_PHOTO_PATH;
            const isAdminMarker =
              item.photo_path === ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH;
            const hasPhoto = Boolean(item.photo_path) && !isAutoMarker && !isAdminMarker;
            const employeeName = item.employee_name ?? 'Unknown Employee';

            return (
              <SurfaceCard padding="lg" style={styles.logCard} tone="default">
                <View style={[styles.logRow, isCompactWidth ? styles.logRowCompact : null]}>
                  <View style={styles.thumbColumn}>
                    {isAutoMarker ? (
                      <View style={[styles.thumbMarker, styles.autoMarker]}>
                        <Text style={styles.autoMarkerText}>AUTO</Text>
                      </View>
                    ) : isAdminMarker ? (
                      <View style={[styles.thumbMarker, styles.adminMarker]}>
                        <Text style={styles.adminMarkerText}>ADMIN</Text>
                      </View>
                    ) : (
                      <Pressable
                        delayLongPress={250}
                        onLongPress={() => {
                          markActivity();
                          setExpandedPhoto({
                            employeeName,
                            timestamp: formatTimestamp(item.timestamp),
                            uri: item.photo_path as string,
                          });
                        }}
                        style={styles.thumbPressable}
                      >
                        <Image source={{ uri: item.photo_path as string }} style={styles.thumbImage} />
                        <Text style={styles.thumbHint}>Hold to enlarge</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.logBody}>
                    <View style={[styles.logHeader, isCompactWidth ? styles.logHeaderCompact : null]}>
                      <View style={styles.logTitleWrap}>
                        <Text numberOfLines={1} style={styles.employeeName}>
                          {employeeName}
                        </Text>
                        <Text style={styles.eventTitle}>{formatEventTitle(item)}</Text>
                      </View>

                      <View style={styles.logChipRow}>
                        <StatusChip
                          label={item.type === 'IN' ? 'Clock In' : 'Clock Out'}
                          size="sm"
                          tone={item.type === 'IN' ? 'success' : 'warning'}
                        />
                        {item.source === 'AUTO' ? (
                          <StatusChip label="Auto" size="sm" tone="warning" />
                        ) : null}
                        {item.admin_tag !== 'NONE' ? (
                          <StatusChip
                            label={humanizeTag(item.admin_tag)}
                            size="sm"
                            tone="info"
                          />
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.timeText}>{formatTimestamp(item.timestamp)}</Text>

                    {item.last_edited_at ? (
                      <Text style={styles.editMetaText}>
                        Edited {formatTimestamp(item.last_edited_at)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </SurfaceCard>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => setExpandedPhoto(null)}
        transparent
        visible={expandedPhoto !== null}
      >
        <Pressable
          onPress={() => setExpandedPhoto(null)}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {expandedPhoto ? (
              <>
                <Image
                  resizeMode="contain"
                  source={{ uri: expandedPhoto.uri }}
                  style={styles.modalImage}
                />
                <Text style={styles.modalTitle}>{expandedPhoto.employeeName}</Text>
                <Text style={styles.modalSubtitle}>{expandedPhoto.timestamp}</Text>
                <Text style={styles.modalHint}>Tap anywhere to close</Text>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  adminMarker: {
    backgroundColor: colors.tints.bronze,
    borderColor: withAlpha(colors.accents.bronze, 0.24),
  },
  adminMarkerText: {
    ...typography.label,
    color: colors.accents.bronze,
  },
  auditCard: {
    minHeight: 0,
  },
  auditCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  auditCardHeaderCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  auditChipRow: {
    alignItems: 'center',
    columnGap: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    rowGap: spacing.xs,
  },
  auditDetails: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  auditEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  auditIntro: {
    flex: 1,
    marginRight: spacing.md,
  },
  auditRow: {
    borderTopColor: colors.borders.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  auditRowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auditRowHeaderCompact: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  auditSummary: {
    ...typography.cardTitle,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.md,
  },
  auditTimestamp: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  autoMarker: {
    backgroundColor: colors.tints.terracotta,
    borderColor: withAlpha(colors.accents.terracotta, 0.24),
  },
  autoMarkerText: {
    ...typography.label,
    color: colors.accents.terracotta,
  },
  compactActionButton: {
    flex: 1,
  },
  editMetaText: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  employeeName: {
    ...typography.cardTitle,
    color: colors.text.primary,
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
  eventTitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  listHeaderStack: {
    gap: spacing.md,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: spacing.hero,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  loadingTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  logBody: {
    flex: 1,
    minWidth: 0,
  },
  logCard: {
    minHeight: 0,
  },
  logChipRow: {
    alignItems: 'center',
    columnGap: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    rowGap: spacing.xs,
  },
  logHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logHeaderCompact: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  logRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  logRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  logTitleWrap: {
    flex: 1,
    marginRight: spacing.md,
    minWidth: 0,
  },
  messageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  messageText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  modalCard: {
    alignItems: 'center',
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.default,
    borderRadius: radius.heroCard,
    borderWidth: 1,
    maxWidth: 920,
    padding: spacing.lg,
    width: '92%',
  },
  modalHint: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  modalImage: {
    borderRadius: radius.card,
    height: 420,
    maxHeight: '70%',
    width: '100%',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(43, 36, 31, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
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
    maxWidth: 720,
  },
  summaryTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  thumbColumn: {
    alignItems: 'flex-start',
    width: 132,
  },
  thumbHint: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  thumbImage: {
    backgroundColor: colors.backgrounds.secondary,
    borderRadius: radius.thumbnail,
    height: 96,
    width: 128,
  },
  thumbMarker: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    width: 128,
  },
  thumbPressable: {
    alignItems: 'center',
  },
  timeText: {
    ...typography.body,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.md,
  },
});
