import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/theme';

export interface VoiceWaveformProps {
  isListening: boolean;
  statusText?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isListening,
  statusText = 'Listening to voice command...',
}) => {
  if (!isListening) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barsRow}>
        <View style={[styles.bar, { height: 18 }]} />
        <View style={[styles.bar, { height: 32 }]} />
        <View style={[styles.bar, { height: 44 }]} />
        <View style={[styles.bar, { height: 26 }]} />
        <View style={[styles.bar, { height: 40 }]} />
        <View style={[styles.bar, { height: 20 }]} />
      </View>
      <Text style={styles.statusText}>{statusText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: THEME.radius.lg,
    marginHorizontal: THEME.spacing.screen,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
  },
  bar: {
    width: 5,
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: THEME.radius.full,
  },
  statusText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
