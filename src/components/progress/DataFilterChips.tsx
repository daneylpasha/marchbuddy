import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts } from '../../theme';

export type FilterPeriod =
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_month'
  | 'last_quarter'
  | 'last_year'
  | 'all_time';

interface FilterOption {
  key: FilterPeriod;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_quarter', label: 'Last Quarter' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all_time', label: 'All Time' },
];

interface DataFilterChipsProps {
  selected: FilterPeriod;
  onSelect: (period: FilterPeriod) => void;
}

export default function DataFilterChips({ selected, onSelect }: DataFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTER_OPTIONS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * Returns { start, end } ISO date strings for a given filter period.
 */
export function getDateRangeForPeriod(period: FilterPeriod): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const toISO = (d: Date) => d.toISOString().split('T')[0];

  switch (period) {
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const start = new Date(today);
      start.setDate(start.getDate() + mondayOffset);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      const end = new Date(today.getFullYear(), q * 3 + 3, 1);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear() + 1, 0, 1);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'last_quarter': {
      const q = Math.floor(today.getMonth() / 3) - 1;
      const year = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
      const adjQ = q < 0 ? q + 4 : q;
      const start = new Date(year, adjQ * 3, 1);
      const end = new Date(year, adjQ * 3 + 3, 1);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'last_year': {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear(), 0, 1);
      return { start: toISO(start), end: toISO(end) };
    }
    case 'all_time':
    default:
      return { start: '2020-01-01', end: toISO(new Date(today.getFullYear() + 1, 0, 1)) };
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: colors.primary,
  },
});
