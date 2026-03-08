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
      <View style={[styles.headerRow, isCompactWidth ? styles.headerRowCompact : null]}>
        <View>
          <Text style={styles.title}>Clock Event Logs</Text>
          <Text style={styles.subtitle}>Most recent events with saved photo thumbnails.</Text>
        </View>
        <View style={[styles.headerActions, isCompactWidth ? styles.headerActionsCompact : null]}>
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
          <PrimaryButton
            fullWidth={isVeryCompactWidth}
            onPress={() => navigation.goBack()}
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
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
        <FlatList
          contentContainerStyle={styles.listContent}
          data={events}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No logs found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, isCompactWidth ? styles.rowCompact : null]}>
              {item.photo_path === AUTO_CLOCK_OUT_MARKER_PHOTO_PATH ? (
                <View
                  style={[
                    styles.thumb,
                    styles.autoThumb,
                    isCompactWidth ? styles.thumbCompact : null,
                  ]}
                >
                  <Text style={styles.autoThumbText}>AUTO</Text>
                </View>
              ) : item.photo_path === ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH ? (
                <View
                  style={[
                    styles.thumb,
                    styles.manualThumb,
                    isCompactWidth ? styles.thumbCompact : null,
                  ]}
                >
                  <Text style={styles.manualThumbText}>ADMIN</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: item.photo_path }}
                  style={[styles.thumb, isCompactWidth ? styles.thumbCompact : null]}
                />
              )}
              <View style={styles.meta}>
                <Text style={styles.employee}>{item.employee_name}</Text>
                <Text style={styles.eventText}>
                  {item.type === 'IN'
                    ? item.source === 'AUTO'
                      ? 'Clock In (Auto)'
                      : 'Clock In'
                    : item.source === 'AUTO'
                      ? 'Clock Out (Auto)'
                      : 'Clock Out'}
                </Text>
                <Text style={styles.timeText}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
                {item.admin_tag !== 'NONE' ? (
                  <Text style={styles.editMetaText}>
                    {item.admin_tag}
                    {item.last_edited_at
                      ? ` • Edited ${new Date(item.last_edited_at).toLocaleString()}`
                      : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </AdminScreenContainer>
  );
}

const styles = StyleSheet.create({
  autoThumb: {
    alignItems: 'center',
    borderColor: colors.warning,
    borderWidth: 1,
    justifyContent: 'center',
  },
  autoThumbText: {
    ...typography.label,
    color: colors.warning,
  },
  manualThumb: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderWidth: 1,
    justifyContent: 'center',
  },
  manualThumbText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  compactActionButton: {
    flex: 1,
  },
  employee: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  editMetaText: {
    ...typography.caption,
    color: colors.primary,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.lg,
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
    ...typography.label,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerActionsCompact: {
    flexWrap: 'wrap',
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  meta: {
    flex: 1,
    gap: spacing.xs,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
  },
  rowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  thumb: {
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 70,
    width: 90,
  },
  thumbCompact: {
    alignSelf: 'flex-start',
    height: 88,
    width: 120,
  },
  timeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
