import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { colors, spacing, typography } from '../../theme';
import StatusChip from './StatusChip';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  badgeLabel?: string;
  badgeTone?: 'neutral' | 'success' | 'info' | 'warning' | 'danger';
  onBack?: () => void;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  badgeLabel,
  badgeTone = 'neutral',
  onBack,
  actions,
}: PageHeaderProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();

  return (
    <View style={[styles.wrapper, isCompactWidth ? styles.wrapperCompact : null]}>
      <View style={styles.headingRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </Pressable>
        ) : null}
        <View style={styles.textWrap}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <View style={[styles.titleRow, isVeryCompactWidth ? styles.titleRowCompact : null]}>
            <Text style={styles.title}>{title}</Text>
            {badgeLabel ? <StatusChip label={badgeLabel} tone={badgeTone} size="sm" /> : null}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {actions ? (
        <View style={[styles.actions, isCompactWidth ? styles.actionsCompact : null]}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginLeft: spacing.lg,
  },
  actionsCompact: {
    marginLeft: 0,
    width: '100%',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 46,
  },
  backButtonText: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: -2,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  headingRow: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 720,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  titleRow: {
    alignItems: 'center',
    columnGap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  titleRowCompact: {
    alignItems: 'flex-start',
  },
  wrapper: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    width: '100%',
  },
  wrapperCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.md,
  },
});
