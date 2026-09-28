import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bot, User, Wrench, Sparkles, ArrowRight } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { AIChatMessage } from '@/types';

export interface AIChatBubbleProps {
  message: AIChatMessage;
  onActionPress?: (action: any) => void;
}

export const AIChatBubble: React.FC<AIChatBubbleProps> = ({
  message,
  onActionPress,
}) => {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userAlign : styles.assistantAlign]}>
      {!isUser && (
        <View style={styles.avatarBot}>
          <Bot size={14} color="#090D16" />
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>

        {/* Render tool invocation badges if any */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <View style={styles.toolsContainer}>
            {message.tool_calls.map((tool, idx) => (
              <View key={idx} style={styles.toolPill}>
                <Wrench size={10} color={THEME.colors.primary} />
                <Text style={styles.toolText}>Tool: {tool.tool}()</Text>
              </View>
            ))}
          </View>
        )}

        {/* Suggested actionable trigger button */}
        {message.suggested_action && onActionPress && (
          <TouchableOpacity
            onPress={() => onActionPress(message.suggested_action)}
            style={styles.actionBtn}
          >
            <Sparkles size={12} color={THEME.colors.primaryLight} />
            <Text style={styles.actionBtnText}>
              {message.suggested_action.type === 'NAVIGATE'
                ? 'Start Navigation with this Route'
                : 'Apply Suggested Stops'}
            </Text>
            <ArrowRight size={12} color={THEME.colors.primaryLight} />
          </TouchableOpacity>
        )}
      </View>

      {isUser && (
        <View style={styles.avatarUser}>
          <User size={14} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    gap: 8,
  },
  userAlign: {
    justifyContent: 'flex-end',
    paddingLeft: 40,
  },
  assistantAlign: {
    justifyContent: 'flex-start',
    paddingRight: 40,
  },
  avatarBot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarUser: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: THEME.colors.secondary,
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: THEME.typography.sizes.sm,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  assistantText: {
    color: THEME.colors.text,
  },
  toolsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.primaryGlow,
  },
  toolText: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  actionBtnText: {
    color: THEME.colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
});
