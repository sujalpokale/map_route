import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, Navigation, Lock } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export interface MapMarkerProps {
  type: 'origin' | 'destination' | 'waypoint' | 'locked' | 'current';
  title?: string;
  sequenceNumber?: number;
}

export const MapMarker: React.FC<MapMarkerProps> = ({
  type,
  title,
  sequenceNumber,
}) => {
  let bgColor = THEME.colors.primary;
  let IconComponent = MapPin;

  if (type === 'origin') {
    bgColor = THEME.colors.markerOrigin;
  } else if (type === 'destination') {
    bgColor = THEME.colors.markerDestination;
  } else if (type === 'locked') {
    bgColor = THEME.colors.markerLocked;
    IconComponent = Lock;
  } else if (type === 'current') {
    bgColor = THEME.colors.currentLocationPuck;
    IconComponent = Navigation;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.markerPin, { backgroundColor: bgColor }]}>
        {sequenceNumber !== undefined ? (
          <Text style={styles.seqText}>{sequenceNumber}</Text>
        ) : (
          <IconComponent size={14} color="#FFFFFF" />
        )}
      </View>
      <View style={[styles.needle, { borderTopColor: bgColor }]} />
      {title && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  seqText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  needle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  labelContainer: {
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    marginTop: 2,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  labelText: {
    color: THEME.colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
});
