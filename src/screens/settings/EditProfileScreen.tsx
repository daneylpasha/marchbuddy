import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useProfileStore } from '../../store/profileStore';
import { colors, spacing, fonts } from '../../theme';
import BebasText from '../../components/common/BebasText';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [height, setHeight] = useState(profile?.height?.toString() ?? '');
  const [currentWeight, setCurrentWeight] = useState(profile?.currentWeight?.toString() ?? '');
  const [targetWeight, setTargetWeight] = useState(profile?.targetWeight?.toString() ?? '');
  const [injuries, setInjuries] = useState(profile?.injuries?.join(', ') ?? '');
  const [allergies, setAllergies] = useState(profile?.dietaryPreferences?.allergies?.join(', ') ?? '');
  const [dislikes, setDislikes] = useState(profile?.dietaryPreferences?.dislikes?.join(', ') ?? '');
  const [cuisineRegion, setCuisineRegion] = useState(profile?.dietaryPreferences?.cuisineRegion ?? '');

  if (!profile) return null;

  const handleSave = () => {
    const parseList = (s: string) =>
      s.split(',').map((v) => v.trim()).filter(Boolean);

    updateProfile({
      name: name.trim() || profile.name,
      age: Number(age) || profile.age,
      height: Number(height) || profile.height,
      currentWeight: Number(currentWeight) || profile.currentWeight,
      targetWeight: Number(targetWeight) || profile.targetWeight,
      injuries: parseList(injuries),
      dietaryPreferences: {
        ...profile.dietaryPreferences,
        allergies: parseList(allergies),
        dislikes: parseList(dislikes),
        cuisineRegion: cuisineRegion.trim() || profile.dietaryPreferences.cuisineRegion,
      },
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <BebasText size={28}>Edit Profile</BebasText>
          <Pressable onPress={handleSave}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>

        {/* Fields */}
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Age" value={age} onChange={setAge} keyboard="numeric" />
        <Field label="Height (cm)" value={height} onChange={setHeight} keyboard="numeric" />
        <Field label="Current Weight (kg)" value={currentWeight} onChange={setCurrentWeight} keyboard="numeric" />
        <Field label="Target Weight (kg)" value={targetWeight} onChange={setTargetWeight} keyboard="numeric" />
        <Field label="Cuisine Region" value={cuisineRegion} onChange={setCuisineRegion} />
        <Field label="Injuries" value={injuries} onChange={setInjuries} placeholder="Comma-separated, or 'none'" />
        <Field label="Allergies" value={allergies} onChange={setAllergies} placeholder="Comma-separated, or 'none'" />
        <Field label="Food Dislikes" value={dislikes} onChange={setDislikes} placeholder="Comma-separated, or 'none'" />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, keyboard, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'numeric';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard === 'numeric' ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.lg },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: {},
  saveText: { color: colors.primary, fontSize: 16, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  field: { marginBottom: 16 },
  fieldLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, fontFamily: fonts.medium, letterSpacing: 0.3 },
  fieldInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },

  bottomSpacer: { height: 40 },
});
