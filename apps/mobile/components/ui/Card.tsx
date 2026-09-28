import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { THEME } from '@/constants/theme';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevated?: boolean;
  bordered?: boolean;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevated = false,
  bordered = true,
  glow = false,
}) => {
  const cardStyle = [
    styles.card,
    elevated && styles.elevated,
    bordered && styles.bordered,
    glow && styles.glow,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
  },
  elevated: {
    backgroundColor: THEME.colors.cardElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bordered: {
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  glow: {
    borderColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
