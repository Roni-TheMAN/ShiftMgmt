import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { colors, layout, radius, spacing, typography } from '../../theme';
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
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{'\u2039'}</Text>
          </Pressable>
        ) : null}

        <View style={styles.textWrap}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}

          <View style={[styles.titleRow, isVeryCompactWidth ? styles.titleRowCompact : null]}>
            <Text style={styles.title}>{title}</Text>
            {badgeLabel ? <StatusChip label={badgeLabel} size="sm" tone={badgeTone} /> : null}
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
    columnGap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginLeft: spacing.lg,
    rowGap: spacing.sm,
  },
  actionsCompact: {
    marginLeft: 0,
    width: '100%',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.default,
    borderRadius: radius.button,
    borderWidth: 1,
    height: layout.touchTarget.minimum,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: layout.touchTarget.minimum,
  },
  backButtonText: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    lineHeight: 26,
    marginTop: -2,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.text.muted,
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
    color: colors.text.secondary,
    marginTop: spacing.xs,
    maxWidth: 760,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text.primary,
    flexShrink: 1,
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
    borderBottomColor: colors.borders.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.section,
    paddingBottom: spacing.md,
    width: '100%',
  },
  wrapperCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.md,
  },
});
