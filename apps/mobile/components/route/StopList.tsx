import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lock, Unlock, Trash2, Clock, AlertTriangle, ArrowUpDown } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { StopItem } from '@/types';
import { Badge } from '@/components/ui/Badge';

export interface StopListProps {
  stops: StopItem[];
  onToggleLock: (id: string) => void;
  onRemoveStop: (id: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

export const StopList: React.FC<StopListProps> = ({
  stops,
  onToggleLock,
  onRemoveStop,
  onMoveUp,
  onMoveDown,
}) => {
  if (stops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No stops added yet. Add stops to optimize your multi-drop route.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {stops.map((stop, index) => {
        const isUrgent = stop.priority === 3;
        const isHigh = stop.priority === 2;

        return (
          <View key={stop.id || index} style={styles.stopCard}>
            {/* Sequence index badge */}
            <View style={styles.seqColumn}>
              <View style={[styles.seqBadge, stop.is_locked && styles.seqBadgeLocked]}>
                <Text style={styles.seqText}>{index + 1}</Text>
              </View>
              {index < stops.length - 1 && <View style={styles.connectorLine} />}
            </View>

            {/* Stop content */}
            <View style={styles.contentColumn}>
              <View style={styles.topRow}>
                <Text style={styles.stopName} numberOfLines={1}>
                  {(stop as any).name || `Stop ${index + 1}`}
                </Text>
                {isUrgent ? (
                  <Badge label="URGENT" variant="danger" size="sm" />
                ) : isHigh ? (
                  <Badge label="HIGH PRIORITY" variant="warning" size="sm" />
                ) : null}
              </View>

              <Text style={styles.addressText} numberOfLines={2}>
                {stop.address}
              </Text>

              {/* Time Window & Package Weight */}
              <View style={styles.metaRow}>
                {stop.time_window_start && stop.time_window_end ? (
                  <View style={styles.timeTag}>
                    <Clock size={11} color={THEME.colors.primaryLight} />
                    <Text style={styles.timeText}>
                      {stop.time_window_start} – {stop.time_window_end}
                    </Text>
                  </View>
                ) : null}

                {stop.package_weight_kg ? (
                  <Text style={styles.weightText}>{stop.package_weight_kg} kg</Text>
                ) : null}
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsColumn}>
              <TouchableOpacity
                onPress={() => onToggleLock(stop.id)}
                style={[styles.actionBtn, stop.is_locked && styles.actionBtnActive]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {stop.is_locked ? (
                  <Lock size={15} color={THEME.colors.warning} />
                ) : (
                  <Unlock size={15} color={THEME.colors.textMuted} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onRemoveStop(stop.id)}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={15} color={THEME.colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: THEME.spacing.sm,
  },
  emptyContainer: {
    padding: THEME.spacing.lg,
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.sm,
    textAlign: 'center',
  },
  stopCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  seqColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: 8,
  },
  seqBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqBadgeLocked: {
    backgroundColor: THEME.colors.warning,
  },
  seqText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  connectorLine: {
    flex: 1,
    width: 2,
    backgroundColor: THEME.colors.cardBorder,
    marginTop: 4,
  },
  contentColumn: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stopName: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  addressText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    lineHeight: 16,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
  },
  timeText: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontWeight: '600',
  },
  weightText: {
    color: THEME.colors.textMuted,
    fontSize: 10,
  },
  actionsColumn: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.cardElevated,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
});
