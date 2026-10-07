import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  MapPin,
  Building,
  Compass,
  Crosshair,
  CheckCircle2,
  Plus,
  RefreshCw,
  Layers,
  Navigation,
  FileText,
  Check,
  AlertTriangle,
  AlertCircle,
  Edit3,
} from 'lucide-react-native';

import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { MapViewAbstraction } from '@/components/map/MapViewAbstraction';
import { useOCRLocationStore } from '@/stores/useOCRLocationStore';
import { ocrService, ParsedLocationItem, ValidationDetails } from '@/services/api/ocr';

interface SamplePreset {
  id: string;
  title: string;
  badge: string;
  text: string;
  imageUri: string;
  coords: { lat: number; lng: number };
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'pune_baner',
    title: 'Pune Tech Corridor',
    badge: 'Baner • 411045',
    text: 'DELIVERY INVOICE #AERO-9821\nRecipient: Rahul Deshmukh\nHigh Street Business Center, 4th Floor, Baner Road, Pune, Maharashtra - 411045\nPackage: 4.2 kg Electronics',
    imageUri: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
    coords: { lat: 18.5590, lng: 73.7868 },
  },
  {
    id: 'mumbai_andheri',
    title: 'Mumbai Logistics Hub',
    badge: 'Andheri E • 400069',
    text: 'WAYBILL #MUM-77301\nDeliver To: Nexus Prime Cargo Hub, Sakinaka Junction, Andheri East, Mumbai, Maharashtra 400069\nContact: 9820123456',
    imageUri: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80',
    coords: { lat: 19.1136, lng: 72.8697 },
  },
  {
    id: 'bengaluru_whitefield',
    title: 'Bengaluru Tech Park',
    badge: 'Whitefield • 560066',
    text: 'SHIP TO: ITPL Main Gate, Sigma Soft Tech Park, Whitefield Main Rd, Bengaluru, Karnataka - 560066\nPriority: Urgent Parcel (1.5 kg)',
    imageUri: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&auto=format&fit=crop&q=80',
    coords: { lat: 12.9830, lng: 77.7505 },
  },
  {
    id: 'delhi_cp',
    title: 'Delhi Commercial Center',
    badge: 'Connaught Pl • 110001',
    text: 'INVOICE #DEL-4412\nTo: Regal Building, Inner Circle, Connaught Place, New Delhi, Delhi 110001\nPackage: Medical Supplies (2.1 kg)',
    imageUri: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&auto=format&fit=crop&q=80',
    coords: { lat: 28.6328, lng: 77.2197 },
  },
];

export default function OCRScanScreen({ showBack = true }: { showBack?: boolean }) {
  const router = useRouter();
  const { setResult: setOCRLocation } = useOCRLocationStore();

  const addressInputRef = useRef<TextInput>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Editable parsed address fields (Clean initial state - NO hardcoded defaults)
  const [cleanedAddress, setCleanedAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [validation, setValidation] = useState<ValidationDetails | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Address detection error state
  const [isAddressNotFound, setIsAddressNotFound] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleLaunchCamera = async () => {
    setIsAddressNotFound(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access in settings to scan photos of delivery bills.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
        base64: true,
        exif: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setActivePresetId(null);
        await processScannedImage(asset.base64, asset.exif);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      Alert.alert('Camera Error', err?.message || 'Unable to open camera.');
    }
  };

  const handlePickFromGallery = async () => {
    setIsAddressNotFound(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo Access Required', 'Please allow gallery permissions to select delivery label photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        base64: true,
        exif: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setActivePresetId(null);
        await processScannedImage(asset.base64, asset.exif);
      }
    } catch (err: any) {
      console.warn('Gallery error:', err);
      Alert.alert('Gallery Error', err?.message || 'Unable to pick photo.');
    }
  };

  const processScannedImage = async (base64?: string | null, exif?: any) => {
    setIsScanning(true);
    setIsAddressNotFound(false);
    setScanError(null);
    try {
      let exifLat: number | undefined;
      let exifLng: number | undefined;

      if (exif?.GPSLatitude && exif?.GPSLongitude) {
        exifLat = Number(exif.GPSLatitude);
        exifLng = Number(exif.GPSLongitude);
        if (exif.GPSLatitudeRef === 'S') exifLat = -exifLat;
        if (exif.GPSLongitudeRef === 'W') exifLng = -exifLng;
      }

      let parsedResult: ParsedLocationItem | null = null;

      if (base64) {
        const apiRes = await ocrService.parseImage(base64, {
          latitude: exifLat,
          longitude: exifLng,
        });

        if (apiRes) {
          if (apiRes.locations && apiRes.locations.length > 0) {
            parsedResult = apiRes.locations[0];
          } else if (apiRes.status === 'no_text_detected' || apiRes.status === 'no_address_detected') {
            setScanError('No readable address was found in this image. Try a closer, sharper photo of the address.');
            setIsAddressNotFound(true);
            return;
          }
        }
      }

      // If backend was not reached, fallback to safe local parsing (NO hardcoded fake Pune text)
      if (!parsedResult) {
        setScanError(base64
          ? 'Could not reach the OCR server. Keep the phone and computer on the same Wi-Fi, and make sure the API server is running.'
          : 'The selected image could not be read. Please choose it again.');
        setIsAddressNotFound(true);
        return;
      }

      // Check if address was actually detected
      const hasAnyAddressData = Boolean(
        parsedResult.cleaned_address?.trim() ||
        parsedResult.city ||
        parsedResult.pincode ||
        parsedResult.geocoded_point
      );

      if (!hasAnyAddressData) {
        setScanError('No address details were returned. Try a closer, sharper photo of the address.');
        setIsAddressNotFound(true);
        return;
      }

      applyParsedLocation(parsedResult);
    } catch (e) {
      console.warn('Error during image OCR parse:', e);
      setScanError(e instanceof Error ? e.message : 'Could not reach the OCR server. Check the connection and try again.');
      setIsAddressNotFound(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectPreset = async (preset: SamplePreset) => {
    setActivePresetId(preset.id);
    setSelectedImage(preset.imageUri);
    setIsScanning(true);
    setIsAddressNotFound(false);

    try {
      const apiRes = await ocrService.parseRawText(preset.text, {
        latitude: preset.coords.lat,
        longitude: preset.coords.lng,
      });

      if (apiRes && apiRes.locations.length > 0) {
        applyParsedLocation(apiRes.locations[0]);
      } else {
        const local = ocrService.extractDetailsLocally(preset.text, {
          latitude: preset.coords.lat,
          longitude: preset.coords.lng,
        });
        applyParsedLocation(local);
      }
    } catch {
      const local = ocrService.extractDetailsLocally(preset.text, {
        latitude: preset.coords.lat,
        longitude: preset.coords.lng,
      });
      applyParsedLocation(local);
    } finally {
      setIsScanning(false);
    }
  };

  const applyParsedLocation = (item: ParsedLocationItem) => {
    setCleanedAddress(item.cleaned_address || '');
    setCity(item.city || '');
    setState(item.state || '');
    setPincode(item.pincode || '');
    if (item.geocoded_point && item.geocoded_point.lat && item.geocoded_point.lng) {
      setLatitude(item.geocoded_point.lat);
      setLongitude(item.geocoded_point.lng);
    } else {
      setLatitude(null);
      setLongitude(null);
    }
    setConfidenceScore(item.confidence_score || 0);
    setValidation(item.validation || null);
    setIsAddressNotFound(false);
    setOCRLocation({
      rawExtractedText: item.raw_extracted_text || '',
      cleanedAddress: item.cleaned_address || '',
      city: item.city || '',
      state: item.state || '',
      pincode: item.pincode || '',
      latitude: item.geocoded_point?.lat ?? null,
      longitude: item.geocoded_point?.lng ?? null,
      confidenceScore: item.confidence_score || 0,
      validation: item.validation || null,
    });
    router.push('/ocr/location');
  };

  /**
   * Handle user tap on the interactive map:
   * Moves pin to tapped coordinates and reverse geocodes to update address, city, state!
   */
  const handleMapPress = async (coords: { latitude: number; longitude: number }) => {
    setLatitude(coords.latitude);
    setLongitude(coords.longitude);
    setIsReverseGeocoding(true);

    try {
      const rev = await ocrService.reverseGeocode(coords.latitude, coords.longitude);
      if (rev) {
        if (!cleanedAddress || cleanedAddress.length < 5) {
          setCleanedAddress(rev.address);
        }
        if (rev.city) setCity(rev.city);
        if (rev.state) setState(rev.state);
      }
    } catch (e) {
      console.warn('Reverse geocode failure:', e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  /**
   * Snap pin directly to device's real-time GPS location
   */
  const handleSnapToDeviceGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('GPS Permission Denied', 'Allow location permission to snap the pin to your current position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc && loc.coords) {
        handleMapPress({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch (err: any) {
      Alert.alert('GPS Error', err?.message || 'Unable to retrieve current GPS location.');
    }
  };

  const handleConfirmAndAddStop = () => {
    router.push('/ocr/location');
  };

  // Dynamic Confidence Badge Helpers
  const getConfidenceLevel = (score: number) => {
    const pct = Math.round(score * 100);
    if (pct >= 95) return { label: `${pct}% Verified`, color: THEME.colors.success, bg: 'rgba(52, 168, 83, 0.15)', border: 'rgba(52, 168, 83, 0.3)' };
    if (pct >= 85) return { label: `${pct}% High Match`, color: THEME.colors.primaryLight, bg: 'rgba(26, 115, 232, 0.15)', border: 'rgba(26, 115, 232, 0.3)' };
    if (pct >= 70) return { label: `${pct}% Review Needed`, color: THEME.colors.warning, bg: 'rgba(251, 188, 4, 0.15)', border: 'rgba(251, 188, 4, 0.3)' };
    return { label: pct > 0 ? `${pct}% Incomplete` : 'Awaiting Input', color: THEME.colors.textMuted, bg: 'rgba(154, 160, 166, 0.12)', border: 'rgba(154, 160, 166, 0.25)' };
  };

  const confidenceBadge = getConfidenceLevel(confidenceScore);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Photo Address & Map Scanner"
        subtitle="Extract address, pincode, state & set accurate map pin"
        showBack={showBack}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Notification Toast */}
        {successToast && (
          <View style={styles.successBanner}>
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={styles.successBannerText}>{successToast}</Text>
          </View>
        )}

        {/* Section 1: Photo Scanner / Upload */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Camera size={18} color={THEME.colors.primaryLight} />
            <Text style={styles.sectionTitle}>1. Capture or Select Photo</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Snap shipping invoice, waybill label, or geotagged site photo to extract location details.
          </Text>

          {/* Photo Preview or Finder Frame */}
          <View style={styles.previewBox}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.placeholderContainer}>
                <FileText size={48} color={THEME.colors.textMuted} />
                <Text style={styles.placeholderPrompt}>
                  Take a photo or choose an invoice to scan
                </Text>
              </View>
            )}

            {/* Scanning overlay laser animation */}
            {isScanning && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator size="large" color={THEME.colors.primaryLight} />
                <Text style={styles.scanningOverlayText}>
                  Extracting Pincode, State, City & Address...
                </Text>
              </View>
            )}

            {/* Corner Viewfinder Reticles */}
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>

          {/* Primary Action Buttons: Camera & Gallery */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleLaunchCamera}
              disabled={isScanning}
            >
              <Camera size={18} color="#090D16" />
              <Text style={styles.actionBtnPrimaryText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={handlePickFromGallery}
              disabled={isScanning}
            >
              <ImageIcon size={18} color={THEME.colors.text} />
              <Text style={styles.actionBtnSecondaryText}>Choose Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Address Not Detected Error Card (Production Error Handling) */}
          {isAddressNotFound && (
            <View style={styles.errorNoticeCard}>
              <View style={styles.errorNoticeHeader}>
                <AlertTriangle size={18} color={THEME.colors.googleRed} />
                <Text style={styles.errorNoticeTitle}>Address could not be detected.</Text>
              </View>

                <Text style={styles.errorNoticeMessage}>
                  {scanError || 'No readable address was found. Please choose another image or enter the address manually.'}
                </Text>
              <View style={styles.errorActionsRow}>
                <TouchableOpacity
                  style={[styles.errorActionChip, styles.errorActionPrimary]}
                  onPress={handleLaunchCamera}
                >
                  <Camera size={14} color="#FFFFFF" />
                  <Text style={styles.errorActionPrimaryText}>Retake Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.errorActionChip, styles.errorActionSecondary]}
                  onPress={handlePickFromGallery}
                >
                  <ImageIcon size={14} color={THEME.colors.text} />
                  <Text style={styles.errorActionSecondaryText}>Choose Another Image</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.errorActionChip, styles.errorActionOutline]}
                  onPress={() => {
                    setIsAddressNotFound(false);
                    setTimeout(() => addressInputRef.current?.focus(), 150);
                  }}
                >
                  <Edit3 size={14} color={THEME.colors.primaryLight} />
                  <Text style={styles.errorActionOutlineText}>Edit Address Manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick 1-Tap Demo Presets */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>OR TEST 1-TAP SAMPLE WAYBILLS & LABELS:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
              {SAMPLE_PRESETS.map((p) => {
                const isActive = activePresetId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetChip, isActive && styles.presetChipActive]}
                    onPress={() => handleSelectPreset(p)}
                  >
                    <Text style={[styles.presetChipTitle, isActive && styles.presetChipTitleActive]}>
                      {p.title}
                    </Text>
                    <Text style={styles.presetChipBadge}>{p.badge}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Section 2: Extracted Location Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Sparkles size={18} color={THEME.colors.primaryLight} />
              <Text style={styles.sectionTitle}>2. Extracted Location Details</Text>
            </View>
            <View style={[styles.confidenceBadge, { backgroundColor: confidenceBadge.bg, borderColor: confidenceBadge.border }]}>
              {confidenceScore >= 0.85 ? (
                <Check size={12} color={confidenceBadge.color} />
              ) : (
                <AlertCircle size={12} color={confidenceBadge.color} />
              )}
              <Text style={[styles.confidenceText, { color: confidenceBadge.color }]}>
                {confidenceBadge.label}
              </Text>
            </View>
          </View>

          {/* Validation Conflict Warning Banner */}
          {validation?.conflict_warning && (
            <View style={styles.conflictBanner}>
              <AlertCircle size={16} color={THEME.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.conflictBannerTitle}>Address Verification Required</Text>
                <Text style={styles.conflictBannerText}>{validation.conflict_warning}</Text>
              </View>
            </View>
          )}

          {/* Full Cleaned Street Address Field */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <MapPin size={14} color={THEME.colors.primaryLight} />
              <Text style={styles.inputLabel}>Street Address / Landmark</Text>
            </View>
            <TextInput
              ref={addressInputRef}
              style={[styles.input, styles.multilineInput]}
              value={cleanedAddress}
              onChangeText={setCleanedAddress}
              multiline
              placeholder="e.g. Flat 402, Sai Residency, Baner Road"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>

          {/* City & State 2-Column Row */}
          <View style={styles.fieldRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabelRow}>
                <Building size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.inputLabel}>City</Text>
              </View>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Pune"
                placeholderTextColor={THEME.colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabelRow}>
                <Compass size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.inputLabel}>State</Text>
              </View>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="e.g. Maharashtra"
                placeholderTextColor={THEME.colors.textMuted}
              />
            </View>
          </View>

          {/* Pincode & Coordinates 2-Column Row */}
          <View style={styles.fieldRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabelRow}>
                <Navigation size={14} color={THEME.colors.warning} />
                <Text style={styles.inputLabel}>Pincode / Postal Code</Text>
              </View>
              <TextInput
                style={[styles.input, styles.pincodeInput]}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="numeric"
                maxLength={6}
                placeholder="411045"
                placeholderTextColor={THEME.colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabelRow}>
                <Crosshair size={14} color={THEME.colors.primaryLight} />
                <Text style={styles.inputLabel}>GPS Coordinates</Text>
              </View>
              <View style={styles.coordDisplayBox}>
                <Text style={[styles.coordDisplayText, (latitude === null || longitude === null) && { color: THEME.colors.textMuted }]}>
                  {latitude !== null && longitude !== null
                    ? `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`
                    : 'Not pinned yet'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 3: Interactive Map for Pin Fine-Tuning */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Layers size={18} color={THEME.colors.primaryLight} />
              <Text style={styles.sectionTitle}>3. Accurate Location Map Pin</Text>
            </View>
            {isReverseGeocoding && (
              <View style={styles.syncingBadge}>
                <ActivityIndicator size="small" color={THEME.colors.primaryLight} />
                <Text style={styles.syncingText}>Updating address...</Text>
              </View>
            )}
          </View>

          <Text style={styles.mapTipText}>
            💡 <Text style={{ fontWeight: '700', color: THEME.colors.text }}>Tap anywhere on the map</Text> to fine-tune the exact gate, drop-off dock, or door.
          </Text>

          {/* Embedded Leaflet Map */}
          <View style={styles.mapContainer}>
            <MapViewAbstraction
              stops={
                latitude !== null && longitude !== null
                  ? [
                      {
                        id: 'scan_pin',
                        name: city || 'Target Drop',
                        address: cleanedAddress || 'Pinned Location',
                        lat: latitude,
                        lng: longitude,
                        priority: 1,
                      },
                    ]
                  : []
              }
              focusedLocation={
                latitude !== null && longitude !== null
                  ? {
                      latitude,
                      longitude,
                      zoom: 16,
                    }
                  : null
              }
              onMapPress={handleMapPress}
              showControls={true}
              interactive={true}
            />

            {/* Floating marker guide chip */}
            <View style={styles.mapCenterIndicator}>
              <MapPin size={14} color={latitude !== null ? THEME.colors.googleRed : THEME.colors.textMuted} />
              <Text style={styles.mapCenterText}>
                {latitude !== null && longitude !== null
                  ? `Pinned: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                  : 'Tap map to drop pin'}
              </Text>
            </View>
          </View>

          {/* Map Helper Quick Action Buttons */}
          <View style={styles.mapActionsRow}>
            <TouchableOpacity style={styles.mapActionChip} onPress={handleSnapToDeviceGps}>
              <Crosshair size={14} color={THEME.colors.primaryLight} />
              <Text style={styles.mapActionChipText}>Use Device GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mapActionChip}
              disabled={latitude === null || longitude === null}
              onPress={() => {
                if (latitude !== null && longitude !== null) {
                  handleMapPress({ latitude, longitude });
                }
              }}
            >
              <RefreshCw size={14} color={latitude !== null ? THEME.colors.textSecondary : THEME.colors.textMuted} />
              <Text style={[styles.mapActionChipText, latitude === null && { color: THEME.colors.textMuted }]}>
                Sync Address
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Button & Confirmation */}
        <View style={styles.footerSection}>
          <Button
            title="View OCR Location"
            onPress={handleConfirmAndAddStop}
            variant="primary"
            size="lg"
            icon={<CheckCircle2 size={20} color="#090D16" />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.screen,
    paddingBottom: 40,
    gap: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.success,
    padding: 12,
    borderRadius: THEME.radius.md,
  },
  successBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: THEME.typography.sizes.sm,
  },
  sectionCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    marginBottom: 12,
    lineHeight: 18,
  },
  previewBox: {
    height: 190,
    backgroundColor: '#0F172A',
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  placeholderPrompt: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.xs,
    textAlign: 'center',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
  },
  scanningOverlayText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: THEME.colors.primaryLight,
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: THEME.colors.primaryLight,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: THEME.colors.primaryLight,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: THEME.colors.primaryLight,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  actionBtnPrimary: {
    backgroundColor: THEME.colors.primaryLight,
  },
  actionBtnPrimaryText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: THEME.typography.sizes.sm,
  },
  actionBtnSecondary: {
    backgroundColor: THEME.colors.cardHover,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  actionBtnSecondaryText: {
    color: THEME.colors.text,
    fontWeight: '600',
    fontSize: THEME.typography.sizes.sm,
  },
  errorNoticeCard: {
    marginTop: 12,
    backgroundColor: 'rgba(234, 67, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 67, 53, 0.35)',
    borderRadius: THEME.radius.md,
    padding: 12,
    gap: 8,
  },
  errorNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorNoticeTitle: {
    color: '#F28B82',
    fontWeight: '700',
    fontSize: THEME.typography.sizes.sm,
  },
  errorNoticeMessage: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    lineHeight: 16,
  },
  errorActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  errorActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
  },
  errorActionPrimary: {
    backgroundColor: '#EA4335',
  },
  errorActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  errorActionSecondary: {
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  errorActionSecondaryText: {
    color: THEME.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  errorActionOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  errorActionOutlineText: {
    color: THEME.colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(251, 188, 4, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 188, 4, 0.35)',
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginBottom: 10,
  },
  conflictBannerTitle: {
    color: THEME.colors.warning,
    fontWeight: '700',
    fontSize: THEME.typography.sizes.xs,
    marginBottom: 2,
  },
  conflictBannerText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  presetsContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardBorder,
    paddingTop: 10,
  },
  presetsLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsRow: {
    gap: 8,
  },
  presetChip: {
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipActive: {
    backgroundColor: 'rgba(26, 115, 232, 0.25)',
    borderColor: THEME.colors.primary,
  },
  presetChipTitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
  },
  presetChipTitleActive: {
    color: THEME.colors.primaryLight,
  },
  presetChipBadge: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  inputLabel: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1F2023',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
  },
  multilineInput: {
    minHeight: 54,
    textAlignVertical: 'top',
  },
  pincodeInput: {
    fontWeight: '700',
    color: THEME.colors.warning,
    letterSpacing: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordDisplayBox: {
    backgroundColor: '#1F2023',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  coordDisplayText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
  },
  mapTipText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    marginBottom: 10,
  },
  mapContainer: {
    height: 250,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    position: 'relative',
  },
  mapCenterIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(32, 33, 36, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    zIndex: 10,
  },
  mapCenterText: {
    color: THEME.colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  mapActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  mapActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  mapActionChipText: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  syncingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  syncingText: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontWeight: '600',
  },
  footerSection: {
    marginTop: 4,
  },
  secondaryConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    backgroundColor: THEME.colors.card,
  },
  secondaryConfirmText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
  },
});
