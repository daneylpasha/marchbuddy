import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import type { WeightEntry } from '../../types';

interface Props {
  entries: WeightEntry[];
}

export default function WeightChart({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Log your weight to see trends</Text>
      </View>
    );
  }

  const weights = entries.map((e) => e.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const chartHeight = 120;
  const barWidth = Math.min(40, (300 - (entries.length - 1) * 6) / entries.length);

  return (
    <View style={styles.container}>
      {/* Y-axis labels */}
      <View style={styles.yAxis}>
        <Text style={styles.yLabel}>{maxW.toFixed(1)}</Text>
        <Text style={styles.yLabel}>{((maxW + minW) / 2).toFixed(1)}</Text>
        <Text style={styles.yLabel}>{minW.toFixed(1)}</Text>
      </View>

      {/* Bars */}
      <View style={styles.chartArea}>
        <View style={[styles.barsRow, { height: chartHeight }]}>
          {entries.map((entry, i) => {
            const normalized = (entry.weight - minW) / range;
            const barHeight = Math.max(8, normalized * (chartHeight - 16) + 8);
            const isLatest = i === entries.length - 1;
            return (
              <View key={entry.id} style={styles.barCol}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={[styles.barValue, isLatest && styles.barValueActive]}>
                    {entry.weight.toFixed(1)}
                  </Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        width: barWidth,
                        backgroundColor: isLatest ? colors.primary : colors.primaryDim,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxis}>
          {entries.map((entry) => {
            const date = new Date(entry.date);
            const label = `${date.getDate()}/${date.getMonth() + 1}`;
            return (
              <Text key={entry.id} style={[styles.xLabel, { width: barWidth }]}>
                {label}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, fontSize: 13, fontFamily: fonts.regular, letterSpacing: 0.3 },
  yAxis: { justifyContent: 'space-between', height: 120, paddingVertical: 8 },
  yLabel: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.regular, letterSpacing: 0.3 },
  chartArea: { flex: 1 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { borderRadius: 4, alignSelf: 'center' },
  barValue: { color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular, letterSpacing: 0.3, textAlign: 'center', marginBottom: 4 },
  barValueActive: { color: colors.primary, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  xAxis: { flexDirection: 'row', gap: 6, marginTop: 6 },
  xLabel: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.regular, letterSpacing: 0.3, textAlign: 'center' },
});
