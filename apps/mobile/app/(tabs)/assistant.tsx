import React, { useState, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Send, Mic, MicOff, Sparkles, Trash2, Bot, Lock } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { AIChatBubble } from '@/components/assistant/AIChatBubble';
import { VoiceWaveform } from '@/components/assistant/VoiceWaveform';
import { QuickActionChips } from '@/components/assistant/QuickActionChips';
import { useAIStore } from '@/stores/useAIStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { usePremiumGate } from '@/services/premium';

export default function AssistantScreen() {
  const router = useRouter();
  const {
    messages,
    sendMessage,
    isThinking,
    isListening,
    setIsListening,
    clearHistory,
  } = useAIStore();
  const { getSelectedRoute } = useRouteStore();
  const { startNavigation } = useNavigationStore();
  const { isPremium, requirePremium } = usePremiumGate('ai_route_assistant');
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());

  const [inputVal, setInputVal] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const selectedRoute = getSelectedRoute();

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim()) return;
    if (!requirePremium()) return;

    setInputVal('');
    await sendMessage(text, {
      current_route: selectedRoute,
      vehicle_type: selectedVehicle.vehicle_type,
      selected_vehicle: selectedVehicle,
      current_location: currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null,
    });

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const handleToggleVoice = () => {
    setIsListening(false);
    Alert.alert('Voice input unavailable', 'Use the text field to enter your route request.');
  };

  const handleActionPress = (action: any) => {
    if (action.type === 'NAVIGATE' && selectedRoute) {
      startNavigation(
        selectedRoute.steps,
        selectedRoute.distance_km,
        selectedRoute.duration_min,
        selectedRoute.coordinates
      );
      router.push({
        pathname: '/navigation/[routeId]',
        params: { routeId: selectedRoute.id },
      });
    } else if (action.type === 'OPTIMIZE_STOPS') {
      router.push('/(tabs)/routes');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="AI Transportation Copilot"
        subtitle="Grounded Tool Execution & Voice AI"
        rightAction={
          <TouchableOpacity onPress={clearHistory} style={styles.clearBtn}>
            <Trash2 size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {!isPremium && (
            <TouchableOpacity style={styles.premiumLockBanner} onPress={requirePremium} activeOpacity={0.82}>
              <View style={styles.premiumLockIcon}>
                <Lock size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumLockTitle}>AI Route Assistant is Premium</Text>
                <Text style={styles.premiumLockText}>
                  Unlock conversational route analysis, AI explanations, and smart actions.
                </Text>
              </View>
              <Text style={styles.premiumLockCta}>UPGRADE</Text>
            </TouchableOpacity>
          )}

          {/* Grounded AI Badge */}
          <View style={styles.groundedPill}>
            <Sparkles size={12} color={THEME.colors.primaryLight} />
            <Text style={styles.groundedText}>
              All answers grounded in real-time IRS scoring & physics models
            </Text>
          </View>

          {messages.map((msg) => (
            <AIChatBubble
              key={msg.id}
              message={msg}
              onActionPress={handleActionPress}
            />
          ))}

          {isThinking && (
            <View style={styles.thinkingRow}>
              <Bot size={16} color={THEME.colors.primaryLight} />
              <Text style={styles.thinkingText}>
                Evaluating 9 IRS scoring factors and calling routing tools...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Voice Waveform when listening */}
        <VoiceWaveform isListening={isListening} />

        {/* Quick Suggestion Chips */}
        <QuickActionChips onSelectPrompt={(p) => handleSend(p)} />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            placeholder={isPremium ? "Ask Route Intelligence (e.g. 'Why this route?')..." : "Premium feature — tap Upgrade above"}
            placeholderTextColor={THEME.colors.textMuted}
            value={inputVal}
            onChangeText={setInputVal}
            editable={isPremium}
            style={styles.textInput}
            onSubmitEditing={() => handleSend()}
          />

          <TouchableOpacity
            onPress={handleToggleVoice}
            style={[styles.micBtn, isListening && styles.micBtnActive]}
          >
            {isListening ? (
              <MicOff size={18} color="#FFFFFF" />
            ) : (
              <Mic size={18} color={THEME.colors.primaryLight} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={isThinking}
            style={[styles.sendBtn, (!inputVal.trim() || !isPremium) && styles.sendBtnDisabled]}
          >
            <Send size={16} color="#090D16" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  clearBtn: {
    padding: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.cardElevated,
  },
  chatScroll: {
    padding: THEME.spacing.screen,
    paddingBottom: 20,
  },
  groundedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.primaryGlow,
    alignSelf: 'center',
    marginBottom: 12,
  },
  groundedText: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontWeight: '600',
  },
  premiumLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(251, 188, 4, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251, 188, 4, 0.45)',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  premiumLockIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#9A6700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumLockTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  premiumLockText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  premiumLockCta: {
    color: '#FBBC04',
    fontSize: 10,
    fontWeight: '900',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.cardElevated,
    padding: 10,
    borderRadius: THEME.radius.md,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  thinkingText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: THEME.spacing.screen,
    paddingVertical: 10,
    backgroundColor: THEME.colors.card,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardBorder,
  },
  textInput: {
    flex: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 14,
    height: 44,
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: THEME.colors.danger,
    borderColor: THEME.colors.danger,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
