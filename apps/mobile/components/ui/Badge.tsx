import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { THEME, getScoreColor, getTrafficColor } from '@/constants/theme';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'score' | 'traffic';
  scoreValue?: number;
  trafficLevel?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  scoreValue,
  trafficLevel,
  size = 'md',
  style,
}) => {
  let bgColor = THEME.colors.primaryGlow;
  let textColor = THEME.colors.primaryLight;
  let borderColor = THEME.colors.primary;

  if (variant === 'score' && scoreValue !== undefined) {
    const scColor = getScoreColor(scoreValue);
    bgColor = `${scColor}22`;
    textColor = scColor;
    borderColor = scColor;
  } else if (variant === 'traffic' && trafficLevel !== undefined) {
    const trColor = getTrafficColor(trafficLevel);
    bgColor = `${trColor}22`;
    textColor = trColor;
    borderColor = trColor;
  } else if (variant === 'success') {
    bgColor = THEME.colors.successGlow;
    textColor = THEME.colors.success;
    borderColor = THEME.colors.success;
  } else if (variant === 'warning') {
    bgColor = THEME.colors.warningGlow;
    textColor = THEME.colors.warning;
    borderColor = THEME.colors.warning;
  } else if (variant === 'danger') {
    bgColor = THEME.colors.dangerGlow;
    textColor = THEME.colors.danger;
    borderColor = THEME.colors.danger;
  } else if (variant === 'neutral') {
    bgColor = 'rgba(255, 255, 255, 0.08)';
    textColor = THEME.colors.textSecondary;
    borderColor = THEME.colors.cardBorder;
  }

  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 10,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSm ? THEME.typography.sizes.xs : THEME.typography.sizes.sm,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
