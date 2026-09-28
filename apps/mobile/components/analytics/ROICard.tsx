import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, Fuel, Clock, IndianRupee } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export interface ROICardProps {
  fuelSavedLitres: number;
  costSavedInr: number;
  timeSavedHours: number;
  totalDistanceKm: number;
}

export const ROICard: React.FC<ROICardProps> = ({
  fuelSavedLitres = 128.4,
  costSavedInr = 13482,
  timeSavedHours = 18.5,
  totalDistanceKm = 3840.5,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <TrendingUp size={18} color={THEME.colors.primaryLight} />
          <Text style={styles.title}>Commercial Intelligence ROI</Text>
        </View>
        <Text style={styles.badge}>This Month</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <View style={styles.statHeader}>
            <IndianRupee size={14} color={THEME.colors.success} />
            <Text style={styles.statLabel}>Cost Saved</Text>
          </View>
          <Text style={[styles.statValue, { color: THEME.colors.success }]}>
            ₹{costSavedInr.toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.statBox}>
          <View style={styles.statHeader}>
            <Fuel size={14} color={THEME.colors.primaryLight} />
            <Text style={styles.statLabel}>Fuel Conserved</Text>
          </View>
          <Text style={[styles.statValue, { color: THEME.colors.primaryLight }]}>
            {fuelSavedLitres} L
          </Text>
        </View>

        <View style={styles.statBox}>
          <View style={styles.statHeader}>
            <Clock size={14} color={THEME.colors.warning} />
            <Text style={styles.statLabel}>Time Reclaimed</Text>
          </View>
          <Text style={[styles.statValue, { color: THEME.colors.warning }]}>
            {timeSavedHours} hrs
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: THEME.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  badge: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: THEME.colors.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  statValue: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: '800',
  },
});
