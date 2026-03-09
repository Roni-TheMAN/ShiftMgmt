import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import {
  ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH,
  AUTO_CLOCK_OUT_MARKER_PHOTO_PATH,
} from '../../constants/app';
import { listClockEventsWithEmployee } from '../../services/repositories/clockEventRepository';
import { colors, spacing, typography } from '../../theme';
import type { ClockEventWithEmployee } from '../../types/database';
import type { RootStackParamList } from '../../types/navigation';

type LogsScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminLogs'>;

export default function LogsScreen({ navigation }: LogsScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const [events, setEvents] = useState<ClockEventWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await listClockEventsWithEmployee(400);
      setEvents(rows);
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

  return (
    <AdminScreenContainer>
      <PageHeader
        actions={
          <>
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={() => {
                markActivity();
                void loadEvents();
              }}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Refresh"
              variant="primary"
            />
          </>
        }
        onBack={() => navigation.goBack()}
        subtitle="Most recent events with saved photo thumbnails."
        title="Clock Event Logs"
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={events}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <SurfaceCard padding="lg" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No logs found.</Text>
            </SurfaceCard>
          }
          renderItem={({ item }) => (
            <SurfaceCard
              padding="lg"
              style={[styles.row, isCompactWidth ? styles.rowCompact : null]}
              tone={item.type === 'IN' ? 'accent' : 'warning'}
            >
              {item.photo_path === AUTO_CLOCK_OUT_MARKER_PHOTO_PATH ? (
                <View style={[styles.thumb, styles.autoThumb, isCompactWidth ? styles.thumbCompact : null]}>
                  <Text style={styles.autoThumbText}>AUTO</Text>
                </View>
              ) : item.photo_path === ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH ? (
                <View style={[styles.thumb, styles.manualThumb, isCompactWidth ? styles.thumbCompact : null]}>
                  <Text style={styles.manualThumbText}>ADMIN</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: item.photo_path }}
                  style={[styles.thumb, isCompactWidth ? styles.thumbCompact : null]}
                />
              )}
              <View style={styles.meta}>
                <View style={styles.metaHeader}>
                  <Text style={styles.employee}>{item.employee_name}</Text>
                  <StatusChip
                    label={item.type === 'IN' ? 'IN' : 'OUT'}
                    tone={item.type === 'IN' ? 'success' : 'warning'}
                  />
                </View>
                <Text style={styles.eventText}>
                  {item.type === 'IN'
                    ? item.source === 'AUTO'
                      ? 'Clock In (Auto)'
                      : 'Clock In'
                    : item.source === 'AUTO'
                      ? 'Clock Out (Auto)'
                      : 'Clock Out'}
                </Text>
                <Text style={styles.timeText}>{new Date(item.timestamp).toLocaleString()}</Text>
                {item.admin_tag !== 'NONE' ? (
                  <Text style={styles.editMetaText}>
                    {item.admin_tag}
                    {item.last_edited_at
                      ? ` - Edited ${new Date(item.last_edited_at).toLocaleString()}`
                      : ''}
                  </Text>
                ) : null}
              </View>
            </SurfaceCard>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  autoThumb: {
    alignItems: 'center',
    backgroundColor: colors.warningMuted,
    justifyContent: 'center',
  },
  autoThumbText: {
    ...typography.label,
    color: colors.warning,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  compactActionButton: {
    flex: 1,
  },
  editMetaText: {
    ...typography.caption,
    color: colors.info,
  },
  employee: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  eventText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  manualThumb: {
    alignItems: 'center',
    backgroundColor: colors.infoMuted,
    justifyContent: 'center',
  },
  manualThumbText: {
    ...typography.caption,
    color: colors.info,
    fontFamily: 'AvenirNext-DemiBold',
  },
  meta: {
    flex: 1,
    gap: spacing.xs,
  },
  metaHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  thumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 84,
    width: 112,
  },
  thumbCompact: {
    alignSelf: 'flex-start',
    height: 96,
    width: 132,
  },
  timeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
