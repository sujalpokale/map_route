import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gauge, Radio } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export interface SpeedometerHUDProps {
  currentSpeedKmh: number;
  speedLimitKmh?: number;
  gpsAccuracyM?: number;
}

export const SpeedometerHUD: React.FC<SpeedometerHUDProps> = ({
  currentSpeedKmh = 42,
  speedLimitKmh = 60,
  gpsAccuracyM = 6,
}) => {
  const isSpeeding = Boolean(speedLimitKmh && currentSpeedKmh > speedLimitKmh);

  return (
    <View style={styles.container}>
      {/* Speedometer dial ring */}
      <View style={[styles.speedBox, isSpeeding ? styles.speedBoxAlert : undefined]}>
        <Text style={[styles.speedNumber, isSpeeding ? styles.speedNumberAlert : undefined]}>
          {Math.round(currentSpeedKmh)}
        </Text>
        <Text style={styles.speedUnit}>KM/H</Text>
      </View>

      {/* Speed limit sign */}
      {speedLimitKmh ? (
        <View style={styles.speedLimitSign}>
          <Text style={styles.limitLabel}>LIMIT</Text>
          <Text style={styles.limitNumber}>{speedLimitKmh}</Text>
        </View>
      ) : null}

      {/* GPS Telematics status */}
      <View style={styles.telematicsPill}>
        <Radio size={10} color={THEME.colors.success} />
        <Text style={styles.telematicsText}>GPS ±{gpsAccuracyM}m</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  speedBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  speedBoxAlert: {
    borderColor: THEME.colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  speedNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  speedNumberAlert: {
    color: THEME.colors.danger,
  },
  speedUnit: {
    color: THEME.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  speedLimitSign: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitLabel: {
    color: '#1E293B',
    fontSize: 7,
    fontWeight: '900',
  },
  limitNumber: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  telematicsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  telematicsText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
});
