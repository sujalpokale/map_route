import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Phone, Navigation, CheckCircle2, Clock, Package } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { DeliveryManifestItem } from '@/stores/useDeliveryStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface DeliveryCardProps {
  delivery: DeliveryManifestItem;
  onNavigate: () => void;
  onOpenProofModal: () => void;
  onMarkArrived: () => void;
}

export const DeliveryCard: React.FC<DeliveryCardProps> = ({
  delivery,
  onNavigate,
  onOpenProofModal,
  onMarkArrived,
}) => {
  const isCompleted = delivery.status === 'COMPLETED';
  const isEnRoute = delivery.status === 'EN_ROUTE';
  const isArrived = delivery.status === 'ARRIVED';

  const handleCall = () => {
    if (delivery.customer_phone) {
      Linking.openURL(`tel:${delivery.customer_phone}`);
    }
  };

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      {/* Top tracking and priority row */}
      <View style={styles.topRow}>
        <View style={styles.trackingGroup}>
          <Package size={14} color={THEME.colors.primaryLight} />
          <Text style={styles.trackingNumber}>{delivery.tracking_number}</Text>
        </View>

        <Badge
          label={delivery.priority}
          variant={
            delivery.priority === 'URGENT'
              ? 'danger'
              : delivery.priority === 'HIGH'
              ? 'warning'
              : 'neutral'
          }
          size="sm"
        />
      </View>

      {/* Recipient Details */}
      <View style={styles.recipientRow}>
        <View style={styles.nameGroup}>
          <Text style={styles.customerName}>{delivery.customer_name}</Text>
          <Text style={styles.packageType}>{delivery.package_type} ({delivery.weight_kg} kg)</Text>
        </View>

        <TouchableOpacity onPress={handleCall} style={styles.callBtn}>
          <Phone size={16} color={THEME.colors.primaryLight} />
        </TouchableOpacity>
      </View>

      {/* Address */}
      <Text style={styles.addressText} numberOfLines={2}>
        {delivery.address}
      </Text>

      {/* Time Window */}
      <View style={styles.timeRow}>
        <Clock size={12} color={THEME.colors.textMuted} />
        <Text style={styles.timeText}>Window: {delivery.time_window}</Text>
      </View>

      {/* Action footer */}
      <View style={styles.footerRow}>
        {isCompleted ? (
          <View style={styles.completedBadge}>
            <CheckCircle2 size={16} color={THEME.colors.success} />
            <Text style={styles.completedText}>
              Delivered at {delivery.completed_at || '11:42 AM'}
            </Text>
          </View>
        ) : (
          <View style={styles.btnRow}>
            <Button
              title="Navigate"
              onPress={onNavigate}
              variant="outline"
              size="sm"
              icon={<Navigation size={13} color={THEME.colors.primary} />}
              style={{ flex: 1 }}
            />
            {isEnRoute ? (
              <Button
                title="Mark Arrived"
                onPress={onMarkArrived}
                variant="secondary"
                size="sm"
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              title="Complete POD"
              onPress={onOpenProofModal}
              variant="primary"
              size="sm"
              style={{ flex: 1.2 }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  cardCompleted: {
    opacity: 0.75,
    borderColor: THEME.colors.success,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackingNumber: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recipientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  nameGroup: {
    flex: 1,
  },
  customerName: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
  },
  packageType: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  addressText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    lineHeight: 18,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  timeText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardBorder,
    paddingTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  completedText: {
    color: THEME.colors.success,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
});
