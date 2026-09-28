import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Sparkles, Leaf, Zap, HelpCircle, Navigation } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export interface QuickActionChipsProps {
  onSelectPrompt: (prompt: string) => void;
}

export const QuickActionChips: React.FC<QuickActionChipsProps> = ({
  onSelectPrompt,
}) => {
  const prompts = [
    { label: 'Optimize for lowest fuel', icon: Leaf, text: 'Optimize my deliveries for minimum fuel cost and show savings.' },
    { label: 'Fastest route to Hinjewadi', icon: Zap, text: 'Find the fastest route to Hinjewadi Phase 1 bypassing congestion.' },
    { label: 'Why was this route chosen?', icon: HelpCircle, text: 'Why did you choose this route over the arterial road?' },
    { label: 'Add Baner as next drop', icon: Navigation, text: 'Add Baner High Street as my next high priority stop.' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {prompts.map((p, idx) => {
          const Icon = p.icon;
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.78}
              onPress={() => onSelectPrompt(p.text)}
              style={styles.chip}
            >
              <Icon size={13} color={THEME.colors.primaryLight} />
              <Text style={styles.chipText}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  scroll: {
    gap: 8,
    paddingHorizontal: THEME.spacing.screen,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.full,
  },
  chipText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
