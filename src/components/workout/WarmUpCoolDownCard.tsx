import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import type { WarmUpCoolDownExercise } from '../../types';

interface WarmUpCoolDownCardProps {
  title: string;
  exercises: WarmUpCoolDownExercise[];
  accentColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function WarmUpCoolDownCard({ title, exercises, accentColor, icon }: WarmUpCoolDownCardProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  if (exercises.length === 0) return null;

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allDone = checkedIds.size === exercises.length;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.header}>
        <Ionicons name={icon} size={16} color={accentColor} />
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        {allDone && (
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.allDoneIcon} />
        )}
      </View>
      {exercises.map((ex) => {
        const isDone = checkedIds.has(ex.id);
        return (
          <Pressable key={ex.id} style={styles.item} onPress={() => toggleCheck(ex.id)}>
            <View style={[styles.checkbox, isDone && { backgroundColor: accentColor, borderColor: accentColor }]}>
              {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <View style={[styles.itemInfo, isDone && styles.itemInfoDone]}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, isDone && styles.nameDone]}>{ex.name}</Text>
                {ex.duration ? (
                  <Text style={styles.duration}>{ex.duration}</Text>
                ) : null}
              </View>
              {ex.description ? (
                <Text style={styles.description}>{ex.description}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  allDoneIcon: {
    marginLeft: 'auto',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemInfoDone: {
    opacity: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
    flex: 1,
  },
  nameDone: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  duration: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
    marginLeft: 8,
  },
  description: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginTop: 2,
    lineHeight: 17,
  },
});
