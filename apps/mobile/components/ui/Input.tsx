import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { THEME } from '@/constants/theme';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  onClear?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: ViewStyle;
  inputStyle?: TextStyle;
  error?: string;
  editable?: boolean;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  icon,
  iconRight,
  onClear,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  inputStyle,
  error,
  editable = true,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={THEME.colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          style={[styles.input, inputStyle]}
        />
        {value && onClear ? (
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : (
          iconRight && <View style={styles.iconRight}>{iconRight}</View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: THEME.spacing.md,
  },
  label: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.sm,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    height: 48,
  },
  inputError: {
    borderColor: THEME.colors.danger,
  },
  iconContainer: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  clearText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: THEME.typography.sizes.xs,
    marginTop: 4,
  },
});
