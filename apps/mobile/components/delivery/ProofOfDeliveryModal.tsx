import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Camera, Edit3, CheckCircle, MapPin } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ProofOfDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  deliveryId: string;
  customerName: string;
  onConfirm: (proofData: { photoUrl?: string; signature?: string; notes?: string }) => void;
}

export const ProofOfDeliveryModal: React.FC<ProofOfDeliveryModalProps> = ({
  visible,
  onClose,
  deliveryId,
  customerName,
  onConfirm,
}) => {
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [notes, setNotes] = useState('');

  const handleCapturePhoto = () => {
    setHasPhoto(true);
  };

  const handleCaptureSignature = () => {
    setHasSignature(true);
  };

  const handleComplete = () => {
    onConfirm({
      photoUrl: hasPhoto ? 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300' : undefined,
      signature: hasSignature ? 'Rahul Deshmukh (Digital Sign)' : undefined,
      notes,
    });
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Proof of Delivery (POD)">
      <View style={styles.container}>
        <Text style={styles.recipientLabel}>Recipient: {customerName}</Text>
        <Text style={styles.subtext}>
          Capture photographic evidence and customer signature to finalize delivery.
        </Text>

        {/* Photo Box */}
        <TouchableOpacity
          onPress={handleCapturePhoto}
          style={[styles.box, hasPhoto && styles.boxCompleted]}
        >
          {hasPhoto ? (
            <View style={styles.completedRow}>
              <CheckCircle size={20} color={THEME.colors.success} />
              <Text style={styles.completedText}>Parcel Photo Geotagged (18.559, 73.786)</Text>
            </View>
          ) : (
            <View style={styles.actionPrompt}>
              <Camera size={22} color={THEME.colors.primary} />
              <Text style={styles.promptText}>Take Photo of Delivered Parcel</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Signature Box */}
        <TouchableOpacity
          onPress={handleCaptureSignature}
          style={[styles.box, hasSignature && styles.boxCompleted]}
        >
          {hasSignature ? (
            <View style={styles.completedRow}>
              <CheckCircle size={20} color={THEME.colors.success} />
              <Text style={styles.completedText}>E-Signature Verified: {customerName}</Text>
            </View>
          ) : (
            <View style={styles.actionPrompt}>
              <Edit3 size={22} color={THEME.colors.primary} />
              <Text style={styles.promptText}>Capture Customer Signature</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Notes */}
        <TextInput
          placeholder="Delivery notes (e.g. Left with security, gate code)"
          placeholderTextColor={THEME.colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          multiline
        />

        {/* Confirm Button */}
        <Button
          title="Submit Proof & Finish Stop"
          onPress={handleComplete}
          variant="success"
          size="lg"
          disabled={!hasPhoto && !hasSignature}
          style={{ marginTop: 12 }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  recipientLabel: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
  },
  subtext: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    lineHeight: 16,
  },
  box: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxCompleted: {
    borderColor: THEME.colors.success,
    backgroundColor: THEME.colors.successGlow,
    borderStyle: 'solid',
  },
  actionPrompt: {
    alignItems: 'center',
    gap: 6,
  },
  promptText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    color: THEME.colors.success,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 12,
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    height: 70,
    textAlignVertical: 'top',
  },
});
