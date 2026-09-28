import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/theme';

export interface TripProgressBarProps {
  progressPct: number;
  remainingDistanceKm: number;
  remainingDurationMin: number;
  etaString: string;
}

export const TripProgressBar: React.FC<TripProgressBarProps> = ({
  progressPct = 35,
  remainingDistanceKm = 14.2,
  remainingDurationMin = 22,
  etaString = '11:15 AM',
}) => {
  return (
    <View style={styles.card}>
      {/* Top summary row */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.durationBig}>{remainingDurationMin} min</Text>
          <Text style={styles.distanceSub}>{remainingDistanceKm} km remaining</Text>
        </View>

        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>ETA</Text>
          <Text style={styles.etaBig}>{etaString}</Text>
        </View>
      </View>

      {/* Progress track */}
      <View style={styles.trackBackground}>
        <View style={[styles.trackFill, { width: `${Math.min(100, Math.max(5, progressPct))}%` }]} />
      </View>

      {/* Progress percentage label */}
      <View style={styles.bottomRow}>
        <Text style={styles.progressText}>{progressPct}% of route completed</Text>
        <Text style={styles.liveTag}>LIVE GPS SYNC</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  durationBig: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  distanceSub: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    marginTop: 2,
  },
  etaContainer: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  etaBig: {
    color: THEME.colors.primaryLight,
    fontSize: 20,
    fontWeight: '800',
  },
  trackBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: THEME.radius.full,
    overflow: 'hidden',
    marginBottom: 8,
  },
  trackFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.full,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  liveTag: {
    color: THEME.colors.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
