import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudSun, Activity, ShieldCheck } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export interface TrafficOverlayProps {
  trafficLevel?: string;
  weatherCondition?: string;
  routeScore?: number;
}

export const TrafficOverlay: React.FC<TrafficOverlayProps> = ({
  trafficLevel = 'Moderate',
  weatherCondition = 'Clear 28°C',
  routeScore = 93.4,
}) => {
  return (
    <View style={styles.floatingContainer}>
      <View style={styles.chip}>
        <Activity size={13} color={THEME.colors.primaryLight} />
        <Text style={styles.chipText}>Traffic: {trafficLevel}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.chip}>
        <CloudSun size={13} color={THEME.colors.warning} />
        <Text style={styles.chipText}>{weatherCondition}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.chip}>
        <ShieldCheck size={13} color={THEME.colors.success} />
        <Text style={[styles.chipText, { color: THEME.colors.success }]}>
          IRS {routeScore}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: THEME.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: THEME.colors.cardBorder,
  },
});
