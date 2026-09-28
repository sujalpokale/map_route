import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SubScores } from '@/types';
import { THEME, getScoreColor } from '@/constants/theme';

export interface IRSScoreBreakdownProps {
  subScores: SubScores;
  overallScore: number;
}

export const IRSScoreBreakdown: React.FC<IRSScoreBreakdownProps> = ({
  subScores,
  overallScore,
}) => {
  const factors = [
    { label: 'Travel Time', score: subScores.time_score, weight: '20%' },
    { label: 'Fuel Physics', score: subScores.fuel_score, weight: '18%' },
    { label: 'Toll & Operational Cost', score: subScores.cost_score, weight: '15%' },
    { label: 'Traffic Smoothness', score: subScores.traffic_score, weight: '15%' },
    { label: 'Distance Efficiency', score: subScores.distance_score, weight: '10%' },
    { label: 'Corridor Weather', score: subScores.weather_score, weight: '8%' },
    { label: 'Road Surface Quality', score: subScores.road_condition_score, weight: '6%' },
    { label: 'Highway Safety Index', score: subScores.safety_score, weight: '5%' },
    { label: 'Vehicle Fit / EV Range', score: subScores.vehicle_compatibility_score, weight: '3%' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>9-Factor IRS Intelligence Breakdown</Text>
        <Text style={[styles.overallText, { color: getScoreColor(overallScore) }]}>
          Overall {overallScore.toFixed(1)} / 100
        </Text>
      </View>

      {factors.map((item, index) => {
        const itemColor = getScoreColor(item.score);
        return (
          <View key={index} style={styles.factorRow}>
            <View style={styles.labelRow}>
              <Text style={styles.factorLabel}>{item.label}</Text>
              <View style={styles.scoreGroup}>
                <Text style={styles.weightLabel}>({item.weight})</Text>
                <Text style={[styles.scoreValue, { color: itemColor }]}>
                  {item.score.toFixed(0)}
                </Text>
              </View>
            </View>

            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, Math.max(5, item.score))}%`,
                    backgroundColor: itemColor,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
    paddingBottom: 8,
  },
  title: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  overallText: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '800',
  },
  factorRow: {
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  factorLabel: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '500',
  },
  scoreGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
  },
  scoreValue: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: THEME.radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: THEME.radius.full,
  },
});
