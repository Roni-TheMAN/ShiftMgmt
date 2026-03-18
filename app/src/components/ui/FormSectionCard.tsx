import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, componentTokens, spacing, typography } from '../../theme';
import SurfaceCard from './SurfaceCard';

type FormSectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: 'default' | 'info' | 'warning' | 'danger';
}>;

export default function FormSectionCard({
  children,
  contentStyle,
  footer,
  style,
  subtitle,
  title,
  tone = 'default',
}: FormSectionCardProps) {
  return (
    <SurfaceCard padding="lg" style={style} tone={tone}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.content, contentStyle]}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: componentTokens.formSection.contentGap,
  },
  footer: {
    marginTop: componentTokens.formSection.footerGap,
    paddingTop: spacing.md,
    borderTopColor: colors.borders.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  header: {
    gap: componentTokens.formSection.headerGap,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  title: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
});
