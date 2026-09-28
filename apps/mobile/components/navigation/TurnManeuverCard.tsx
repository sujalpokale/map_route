import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUpRight, CornerUpRight, ArrowUp, Navigation2 } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export interface TurnManeuverCardProps {
  instruction: string;
  distanceToTurnM: number;
  currentRoadName?: string;
  nextRoadName?: string;
}

export const TurnManeuverCard: React.FC<TurnManeuverCardProps> = ({
  instruction,
  distanceToTurnM,
  currentRoadName = 'Shivaji Road',
  nextRoadName = 'NH 48 Bypass',
}) => {
  const formattedDistance =
    distanceToTurnM >= 1000
      ? `${(distanceToTurnM / 1000).toFixed(1)} km`
      : `${Math.round(distanceToTurnM)} m`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.turnIconWrapper}>
          <CornerUpRight size={32} color="#090D16" />
        </View>

        <View style={styles.distanceGroup}>
          <Text style={styles.distanceText}>{formattedDistance}</Text>
          <Text style={styles.roadTargetText} numberOfLines={1}>
            {nextRoadName}
          </Text>
        </View>
      </View>

      <View style={styles.instructionRow}>
        <Text style={styles.instructionText}>{instruction}</Text>
      </View>

      <View style={styles.currentRoadRow}>
        <Navigation2 size={12} color={THEME.colors.textMuted} style={{ transform: [{ rotate: '45deg' }] }} />
        <Text style={styles.currentRoadText} numberOfLines={1}>
          Current: {currentRoadName}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  distanceGroup: {
    flex: 1,
  },
  distanceText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roadTargetText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
    marginTop: 2,
  },
  instructionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  instructionText: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  currentRoadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  currentRoadText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
});
