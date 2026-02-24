import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../theme';
import BebasText from '../../components/common/BebasText';
import { useWaterStore } from '../../store/waterStore';
import { useAuthStore } from '../../store/authStore';

const QUICK_AMOUNTS = [150, 250, 500, 750];

export default function WaterScreen() {
  const user = useAuthStore((s) => s.user);
  const { todayWaterLog, fetchTodayWaterLog, logWater, removeWaterEntry, updateGoal } =
    useWaterStore();

  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (!todayWaterLog && user) {
      fetchTodayWaterLog(user.id);
    }
  }, [todayWaterLog, user, fetchTodayWaterLog]);

  if (!todayWaterLog) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="water-outline" size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 12 }}>Loading water log...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const water = todayWaterLog;
  const pct = Math.min(water.consumed / water.goal, 1);
  const remaining = Math.max(water.goal - water.consumed, 0);

  const handleGoalSave = () => {
    const val = Number(goalInput);
    if (val >= 500 && val <= 6000) {
      updateGoal(val);
    }
    setGoalModalVisible(false);
    setGoalInput('');
  };

  const handleCustomAdd = () => {
    const val = Number(customInput);
    if (val > 0 && val <= 2000) {
      logWater(val);
    }
    setCustomModalVisible(false);
    setCustomInput('');
  };

  const handleRemoveEntry = (entryId: string) => {
    Alert.alert('Remove Entry', 'Remove this water entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeWaterEntry(entryId) },
    ]);
  };

  // ─── Fill visualization ──────────────────────────────────────────────────

  const fillHeight = `${Math.round(pct * 100)}%` as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={water.entries.slice().reverse()}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* ── Header ────────────────────────────────── */}
            <View style={styles.headerRow}>
              <BebasText>Water Tracking</BebasText>
              <Pressable onPress={() => { setGoalInput(water.goal.toString()); setGoalModalVisible(true); }}>
                <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>

            {/* ── Water fill visual ─────────────────────── */}
            <View style={styles.fillCard}>
              <View style={styles.fillContainer}>
                <View style={[styles.fillLevel, { height: fillHeight }]} />
                <View style={styles.fillOverlay}>
                  <Ionicons name="water" size={32} color="#fff" />
                  <Text style={styles.fillValue}>{water.consumed}</Text>
                  <Text style={styles.fillUnit}>/ {water.goal} ml</Text>
                </View>
              </View>
              <View style={styles.fillStats}>
                <Text style={styles.pctText}>{Math.round(pct * 100)}%</Text>
                <Text style={styles.remainText}>{remaining} ml remaining</Text>
                {pct >= 1 && (
                  <View style={styles.goalReached}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.goalReachedText}>Goal reached!</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Quick-add buttons ────────────────────── */}
            <Text style={styles.sectionTitle}>Quick Add</Text>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((amt) => (
                <Pressable key={amt} style={styles.quickBtn} onPress={() => logWater(amt)}>
                  <Ionicons name="water" size={16} color={colors.water} />
                  <Text style={styles.quickBtnText}>{amt}ml</Text>
                </Pressable>
              ))}
              <Pressable style={styles.quickBtnCustom} onPress={() => setCustomModalVisible(true)}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.quickBtnCustomText}>Custom</Text>
              </Pressable>
            </View>

            {/* ── Log header ───────────────────────────── */}
            <Text style={styles.sectionTitle}>Today's Log</Text>
          </>
        }
        renderItem={({ item }) => {
          const time = new Date(item.loggedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });
          return (
            <Pressable style={styles.entryRow} onLongPress={() => handleRemoveEntry(item.id)}>
              <Ionicons name="water" size={18} color={colors.water} />
              <Text style={styles.entryAmount}>{item.amount} ml</Text>
              <Text style={styles.entryTime}>{time}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No water logged yet today</Text>
          </View>
        }
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      />

      {/* ── Goal adjustment modal ────────────────────── */}
      <Modal visible={goalModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Daily Water Goal</Text>
            <TextInput
              style={styles.modalInput}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="numeric"
              placeholder="e.g. 2500"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />
            <Text style={styles.modalHint}>Recommended: 2000–3000 ml</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setGoalModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleGoalSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Custom amount modal ──────────────────────── */}
      <Modal visible={customModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Custom Amount</Text>
            <TextInput
              style={styles.modalInput}
              value={customInput}
              onChangeText={setCustomInput}
              keyboardType="numeric"
              placeholder="ml"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setCustomModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleCustomAdd}>
                <Text style={styles.modalSaveText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenPadding },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: {},
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 2, marginBottom: 20, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Fill card
  fillCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  fillContainer: {
    width: 100,
    height: 140,
    borderRadius: 16,
    backgroundColor: colors.background,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fillLevel: {
    backgroundColor: colors.waterDim,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    width: '100%',
  },
  fillOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fillValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4, fontFamily: fonts.bold, letterSpacing: 0.3 },
  fillUnit: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.regular, letterSpacing: 0.3 },
  fillStats: { flex: 1, gap: 4 },
  pctText: { color: colors.water, fontSize: 32, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 0.3 },
  remainText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, letterSpacing: 0.3 },
  goalReached: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  goalReachedText: { color: colors.success, fontSize: 14, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Quick add
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 12, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.waterDim,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    minHeight: 48,
  },
  quickBtnText: { color: colors.water, fontSize: 14, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  quickBtnCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    minHeight: 48,
  },
  quickBtnCustomText: { color: colors.primary, fontSize: 14, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Entry rows
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
    minHeight: 48,
  },
  entryAmount: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  entryTime: { color: colors.textTertiary, fontSize: 13, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Empty
  emptyCard: { backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: { backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 24, width: '80%' },
  modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  modalHint: { color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginBottom: 16, fontFamily: fonts.regular, letterSpacing: 0.3 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dotInactive,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  bottomSpacer: { height: 20 },
});
