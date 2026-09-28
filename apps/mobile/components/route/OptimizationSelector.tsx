import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Zap, Compass, IndianRupee, Leaf, Scale, Truck, BatteryCharging } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { OptimizationMode } from '@/types';

export interface OptimizationSelectorProps {
  selectedMode: OptimizationMode;
  onSelectMode: (mode: OptimizationMode) => void;
}

export const OptimizationSelector: React.FC<OptimizationSelectorProps> = ({
  selectedMode,
  onSelectMode,
}) => {
  const modes: { id: OptimizationMode; label: string; icon: any; desc: string }[] = [
    { id: 'Balanced', label: 'Balanced', icon: Scale, desc: 'Optimal time, cost & safety' },
    { id: 'Fastest', label: 'Fastest', icon: Zap, desc: 'Minimum travel duration' },
    { id: 'Fuel Efficient', label: 'Eco Fuel', icon: Leaf, desc: 'Lowest fuel & emissions' },
    { id: 'Cheapest', label: 'Cheapest', icon: IndianRupee, desc: 'Zero toll & low ops' },
    { id: 'Fleet Optimized', label: 'Fleet VRP', icon: Truck, desc: 'Multi-stop payload balance' },
    { id: 'EV Optimal', label: 'EV Optimal', icon: BatteryCharging, desc: 'Regen & SoC preservation' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Optimization Objective</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;

          return (
            <TouchableOpacity
              key={mode.id}
              activeOpacity={0.78}
              onPress={() => onSelectMode(mode.id)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
              ]}
            >
              <Icon
                size={16}
                color={isSelected ? THEME.colors.primaryLight : THEME.colors.textSecondary}
              />
              <Text
                style={[
                  styles.chipLabel,
                  isSelected && styles.chipLabelSelected,
                ]}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: THEME.spacing.sm,
  },
  title: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  scrollContent: {
    gap: 8,
    paddingRight: THEME.spacing.screen,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.full,
  },
  chipSelected: {
    backgroundColor: THEME.colors.primaryGlow,
    borderColor: THEME.colors.primary,
  },
  chipLabel: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: THEME.colors.primaryLight,
    fontWeight: '700',
  },
});
