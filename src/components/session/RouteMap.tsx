import React, { useRef } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { GeoPoint } from '../../types/session';
import { colors } from '../../theme';

interface RouteMapProps {
  route: GeoPoint[];
  height?: number;
  style?: ViewStyle;
}

// Renders a static preview of a recorded walk/run route. Uses Apple Maps on
// iOS (free, no API key) and Google Maps on Android (requires the Google
// Maps API key configured in app.json under android.config.googleMaps).
//
// Returns null when there's nothing meaningful to draw — single fix or no
// route data — so the parent screen can render its normal layout for
// indoor / treadmill / GPS-denied sessions without needing its own guard.
export function RouteMap({ route, height = 200, style }: RouteMapProps) {
  const mapRef = useRef<MapView>(null);

  if (!route || route.length < 2) return null;

  const coords = route.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));
  const start = coords[0];
  const end = coords[coords.length - 1];

  // Initial region — rough fit; fitToCoordinates on map-ready tightens it.
  // Without this, the map briefly renders centered on (0,0) before the fit.
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const initialRegion: Region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.005, (maxLng - minLng) * 1.4),
  };

  return (
    <View style={[styles.container, { height }, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        toolbarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
            animated: false,
          });
        }}
      >
        <Polyline
          coordinates={coords}
          strokeColor={colors.primary}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />
        <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.markerDot, styles.markerStart]} />
        </Marker>
        <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.markerDot, styles.markerEnd]} />
        </Marker>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerStart: {
    backgroundColor: colors.success,
  },
  markerEnd: {
    backgroundColor: colors.primary,
  },
});
