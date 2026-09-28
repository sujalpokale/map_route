import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, Navigation, Fuel, IndianRupee, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { THEME, getScoreColor } from '@/constants/theme';
import { CandidateRoute } from '@/types';
import { Badge } from '@/components/ui/Badge';

export interface RouteCardProps {
  route: CandidateRoute;
  isSelected?: boolean;
  onSelect: () => void;
  onViewDetails?: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isSelected = false,
  onSelect,
  onViewDetails,
}) => {
  const scoreColor = getScoreColor(route.overall_score);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onSelect}
      style={[
        styles.card,
        isSelected && styles.cardSelected,
      ]}
    >
      {/* Top Title & Score Pill */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          {isSelected && (
            <CheckCircle2 size={16} color={THEME.colors.primary} style={styles.selectedIcon} />
          )}
          <Text style={styles.routeLabel} numberOfLines={1}>
            {route.label}
          </Text>
        </View>

        <View style={[styles.scorePill, { borderColor: scoreColor, backgroundColor: `${scoreColor}18` }]}>
          <Sparkles size={12} color={scoreColor} style={{ marginRight: 4 }} />
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            IRS {route.overall_score.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Primary Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Clock size={15} color={THEME.colors.primaryLight} />
          <Text style={styles.metricValue}>{route.duration_min} min</Text>
          <Text style={styles.metricSub}>ETA {route.eta_iso}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Navigation size={15} color={THEME.colors.secondary} />
          <Text style={styles.metricValue}>{route.distance_km} km</Text>
          <Text style={styles.metricSub}>Distance</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Fuel size={15} color={THEME.colors.warning} />
          <Text style={styles.metricValue}>{route.fuel_litres} L</Text>
          <Text style={styles.metricSub}>Fuel Est.</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <IndianRupee size={15} color={THEME.colors.success} />
          <Text style={styles.metricValue}>₹{Math.round(route.total_cost_inr)}</Text>
          <Text style={styles.metricSub}>Total Cost</Text>
        </View>
      </View>

      {/* AI Recommendation Reason */}
      {route.recommendation_reason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonText} numberOfLines={2}>
            💡 {route.recommendation_reason}
          </Text>
        </View>
      ) : null}

      {/* Tags row */}
      <View style={styles.tagsRow}>
        <Badge
          label={`Traffic: ${route.traffic_level}`}
          variant="traffic"
          trafficLevel={route.traffic_level}
          size="sm"
        />
        <Badge label={route.weather_condition} variant="neutral" size="sm" />
        <Badge label={route.road_quality} variant="neutral" size="sm" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  cardSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedIcon: {
    marginRight: 6,
  },
  routeLabel: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
    flex: 1,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  scoreText: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: THEME.spacing.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    marginTop: 3,
  },
  metricSub: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.cardBorder,
  },
  reasonBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.xs,
    marginBottom: THEME.spacing.sm,
  },
  reasonText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
