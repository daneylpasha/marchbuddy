import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../theme';
import type { FoodSnap } from '../../types';

interface FoodSnapCardProps {
  snap: FoodSnap;
}

const CONFIDENCE_COLORS = {
  low: '#e53935',
  medium: '#ff9800',
  high: '#4caf50',
};

export default function FoodSnapCard({ snap }: FoodSnapCardProps) {
  const estimate = snap.userAmended && snap.amendedValues
    ? { ...snap.aiEstimate, ...snap.amendedValues }
    : snap.aiEstimate;

  return (
    <View style={styles.card}>
      <Image source={{ uri: snap.imageUri }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>{snap.aiEstimate.description}</Text>
        <View style={styles.row}>
          <Text style={styles.calories}>{estimate.calories} cal</Text>
          <View style={[styles.badge, { backgroundColor: CONFIDENCE_COLORS[snap.aiEstimate.confidence] + '22' }]}>
            <Text style={[styles.badgeText, { color: CONFIDENCE_COLORS[snap.aiEstimate.confidence] }]}>
              {snap.aiEstimate.confidence}
            </Text>
          </View>
          {snap.userAmended && (
            <Text style={styles.amended}>Amended</Text>
          )}
        </View>
        <Text style={styles.macros}>
          P {estimate.protein}g {'\u00B7'} C {estimate.carbs}g {'\u00B7'} F {estimate.fat}g
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  description: {
    color: '#e8e8e8',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calories: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  amended: {
    color: '#ff9800',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  macros: {
    color: '#666',
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
});
