import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { THEME } from '@/constants/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  style,
  textStyle,
}) => {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          container: {
            backgroundColor: THEME.colors.cardElevated,
            borderColor: THEME.colors.cardBorder,
            borderWidth: 1,
          },
          text: { color: THEME.colors.text },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: THEME.colors.primary,
            borderWidth: 1.5,
          },
          text: { color: THEME.colors.primary },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: THEME.colors.danger,
            borderColor: THEME.colors.danger,
          },
          text: { color: '#FFFFFF' },
        };
      case 'success':
        return {
          container: {
            backgroundColor: THEME.colors.success,
            borderColor: THEME.colors.success,
          },
          text: { color: '#FFFFFF' },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 0,
          },
          text: { color: THEME.colors.textSecondary },
        };
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: THEME.colors.primary,
            borderColor: THEME.colors.primary,
            shadowColor: THEME.colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 4,
          },
          text: { color: THEME.colors.textInverse, fontWeight: '700' },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: THEME.radius.md },
          text: { fontSize: THEME.typography.sizes.sm },
        };
      case 'lg':
        return {
          container: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: THEME.radius.lg },
          text: { fontSize: THEME.typography.sizes.lg, fontWeight: '700' },
        };
      case 'md':
      default:
        return {
          container: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: THEME.radius.md },
          text: { fontSize: THEME.typography.sizes.md, fontWeight: '600' },
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        vStyles.container,
        sStyles.container,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={vStyles.text.color || THEME.colors.text}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.text, vStyles.text, sStyles.text, textStyle]}>
            {title}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  text: {
    fontFamily: THEME.typography.fontFamily.medium,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
