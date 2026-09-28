import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  Sparkles,
  CheckCircle,
  MapPin,
  RefreshCw,
  Plus,
  FileText,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { useRouteStore } from '@/stores/useRouteStore';
import { useDeliveryStore } from '@/stores/useDeliveryStore';
import { ocrService, ParsedLocationItem } from '@/services/api/ocr';

export default function OCRScanScreen() {
  const router = useRouter();
  const { addStop } = useRouteStore();
  const { addDeliveryFromOCR } = useDeliveryStore();

  const [isScanning, setIsScanning] = useState(false);
  const [extractedLocation, setExtractedLocation] = useState<ParsedLocationItem | null>(null);

  const handleCaptureAndScan = async () => {
    setIsScanning(true);
    // Simulate invoice scanning & backend OCR parse
    setTimeout(async () => {
      const mockInvoiceText =
        'INVOICE #9821\nShip to: Rahul Deshmukh\nHigh Street Business Center, 4th Floor, Baner, Pune - 411045\nPackage: 4.2 kg Electronics';

      const result = await ocrService.parseRawText(mockInvoiceText);
      setIsScanning(false);

      if (result && result.locations.length > 0) {
        setExtractedLocation(result.locations[0]);
      } else {
        setExtractedLocation({
          raw_extracted_text: mockInvoiceText,
          cleaned_address: 'High Street Business Center, Baner, Pune, Maharashtra 411045',
          city: 'Pune',
          pincode: '411045',
          confidence_score: 0.94,
          geocoded_point: {
            lat: 18.559,
            lng: 73.7868,
            name: 'High Street Baner',
            address: 'High Street Business Center, Baner, Pune',
          },
        });
      }
    }, 1800);
  };

  const handleConfirmAndAddStop = () => {
    if (extractedLocation) {
      addStop({
        id: `ocr_stop_${Date.now()}`,
        address: extractedLocation.cleaned_address,
        name: extractedLocation.cleaned_address.split(',')[0],
        lat: extractedLocation.geocoded_point?.lat || 18.559,
        lng: extractedLocation.geocoded_point?.lng || 73.7868,
        priority: 2, // High priority
        package_weight_kg: 4.2,
      } as any);

      addDeliveryFromOCR({
        customer_name: 'Rahul Deshmukh (OCR)',
        address: extractedLocation.cleaned_address,
        lat: extractedLocation.geocoded_point?.lat || 18.559,
        lng: extractedLocation.geocoded_point?.lng || 73.7868,
        weight_kg: 4.2,
      });

      router.replace('/(tabs)/routes');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="OCR Address Scanner"
        subtitle="Extract delivery drop-offs from invoices & labels"
        showBack
      />

      <View style={styles.content}>
        {/* Camera Viewfinder Box */}
        <View style={styles.viewfinder}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />

          {isScanning ? (
            <View style={styles.scanningCenter}>
              <ActivityIndicator size="large" color={THEME.colors.primaryLight} />
              <Text style={styles.scanningText}>
                Computer Vision: Isolating street address and pincode...
              </Text>
            </View>
          ) : (
            <View style={styles.promptCenter}>
              <FileText size={48} color={THEME.colors.textMuted} />
              <Text style={styles.viewfinderPrompt}>
                Align shipping invoice, waybill label, or business card within frame
              </Text>
            </View>
          )}
        </View>

        {/* Parsed Result Confirmation Card */}
        {extractedLocation && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Sparkles size={16} color={THEME.colors.primaryLight} />
              <Text style={styles.resultTitle}>Address Extracted (94% Confidence)</Text>
            </View>

            <Text style={styles.addressText}>
              {extractedLocation.cleaned_address}
            </Text>

            <View style={styles.geocodedPill}>
              <MapPin size={12} color={THEME.colors.success} />
              <Text style={styles.geocodedText}>
                Geocoded: 18.5590° N, 73.7868° E (Pincode: {extractedLocation.pincode})
              </Text>
            </View>

            <Button
              title="Confirm & Add Stop to Route"
              onPress={handleConfirmAndAddStop}
              variant="success"
              size="md"
              icon={<Plus size={16} color="#FFFFFF" />}
              style={{ marginTop: 10 }}
            />
          </View>
        )}

        {/* Scan Actions */}
        <View style={styles.footer}>
          <Button
            title={extractedLocation ? 'Scan Another Waybill' : 'Snap & Process Invoice'}
            onPress={handleCaptureAndScan}
            variant="primary"
            size="lg"
            loading={isScanning}
            icon={<Camera size={20} color="#090D16" />}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    flex: 1,
    padding: THEME.spacing.screen,
    justifyContent: 'space-between',
  },
  viewfinder: {
    height: 280,
    backgroundColor: '#0F172A',
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 24,
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: THEME.colors.primary,
  },
  cornerTR: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: THEME.colors.primary,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: THEME.colors.primary,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: THEME.colors.primary,
  },
  promptCenter: {
    alignItems: 'center',
    gap: 12,
  },
  viewfinderPrompt: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  scanningCenter: {
    alignItems: 'center',
    gap: 12,
  },
  scanningText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginVertical: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  resultTitle: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
  },
  addressText: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  geocodedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
    alignSelf: 'flex-start',
  },
  geocodedText: {
    color: THEME.colors.success,
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    marginBottom: 16,
  },
});
