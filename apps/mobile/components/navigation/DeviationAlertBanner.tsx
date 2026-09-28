import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, CornerDownRight, X } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Button } from '@/components/ui/Button';

export interface DeviationAlertBannerProps {
  deviationM: number;
  timeSavedMin?: number;
  onApplyReroute: () => void;
  onDismiss: () => void;
}

export const DeviationAlertBanner: React.FC<DeviationAlertBannerProps> = ({
  deviationM,
  timeSavedMin = 8,
  onApplyReroute,
  onDismiss,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <AlertTriangle size={20} color={THEME.colors.warning} />
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.title}>Dynamic Reroute Available</Text>
          <Text style={styles.desc}>
            Vehicle is {Math.round(deviationM)}m off corridor. Faster bypass avoids junction congestion.
          </Text>
        </View>

        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <X size={16} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <View style={styles.savingsPill}>
          <Text style={styles.savingsText}>Saves {timeSavedMin} min</Text>
        </View>

        <Button
          title="Apply Detour"
          onPress={onApplyReroute}
          variant="primary"
          size="sm"
          icon={<CornerDownRight size={14} color="#090D16" />}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(23, 34, 59, 0.96)',
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.warning,
    shadowColor: THEME.colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconBox: {
    marginRight: 10,
    marginTop: 2,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  desc: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  dismissBtn: {
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  savingsPill: {
    backgroundColor: THEME.colors.successGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.success,
  },
  savingsText: {
    color: THEME.colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
});
