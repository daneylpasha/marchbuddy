import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../theme';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import TypingIndicator from '../../components/chat/TypingIndicator';
import { analyzeFoodPhoto } from '../../services/aiService';
import type { FoodAnalysisResult } from '../../services/aiService';
import { useNutritionStore } from '../../store/nutritionStore';
import { useAuthStore } from '../../store/authStore';
import type { NutritionStackParamList } from './NutritionNavigator';
import { generateUUID } from '../../utils/uuid';

type Props = NativeStackScreenProps<NutritionStackParamList, 'FoodSnap'>;

type Step = 'capture' | 'analyzing' | 'review' | 'error';

const CONFIDENCE_COLORS = { low: colors.danger, medium: colors.warning, high: colors.success };

export default function FoodSnapScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [editedValues, setEditedValues] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [hasEdited, setHasEdited] = useState(false);

  const addFoodSnap = useNutritionStore((s) => s.addFoodSnap);
  const userId = useAuthStore((s) => s.user?.id ?? 'anonymous');

  // Show capture screen with camera/gallery choice on mount (no auto-open)

  const openPicker = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      navigation.goBack();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (result.canceled) {
      navigation.goBack();
      return;
    }
    const uri = result.assets[0].uri;
    setImageUri(uri);
    analyze(uri);
  }, [navigation]);

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setImageUri(uri);
    analyze(uri);
  }, []);

  // Step 2: analyze
  const analyze = async (uri: string) => {
    setStep('analyzing');
    try {
      const analysis = await analyzeFoodPhoto(uri);
      setResult(analysis);
      setEditedValues({
        calories: analysis.calories.toString(),
        protein: analysis.protein.toString(),
        carbs: analysis.carbs.toString(),
        fat: analysis.fat.toString(),
      });
      setStep('review');
    } catch (e) {
      console.error('[FoodSnap] analysis failed:', e);
      setStep('error');
    }
  };

  // Step 3: save
  const handleSave = (amended: boolean) => {
    if (!imageUri || !result) return;

    const amendedValues = amended
      ? {
          calories: Number(editedValues.calories) || result.calories,
          protein: Number(editedValues.protein) || result.protein,
          carbs: Number(editedValues.carbs) || result.carbs,
          fat: Number(editedValues.fat) || result.fat,
        }
      : undefined;

    addFoodSnap({
      id: generateUUID(),
      userId,
      imageUri,
      aiEstimate: {
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        confidence: result.confidence,
        description: result.description,
      },
      userAmended: amended,
      amendedValues,
      createdAt: new Date().toISOString(),
    });

    navigation.goBack();
  };

  const updateValue = (field: keyof typeof editedValues, value: string) => {
    setEditedValues((prev) => ({ ...prev, [field]: value }));
    setHasEdited(true);
  };

  // ─── Step: Capture (fallback if picker dismissed without going back) ────────

  if (step === 'capture' && !imageUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.captureContainer}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          <Text style={styles.captureTitle}>Snap Your Food</Text>
          <Text style={styles.captureSubtitle}>Take a photo for instant calorie estimation</Text>
          <View style={styles.captureActions}>
            <Pressable style={styles.captureBtn} onPress={openCamera}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.captureBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.captureBtnOutline} onPress={openPicker}>
              <Ionicons name="images" size={20} color={colors.primary} />
              <Text style={styles.captureBtnOutlineText}>Choose from Gallery</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step: Analyzing ────────────────────────────────────────────────────────

  if (step === 'analyzing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.analyzingContainer}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.analyzingImage} resizeMode="cover" />}
          <View style={styles.analyzingOverlay}>
            <TypingIndicator />
            <Text style={styles.analyzingText}>Analyzing your food...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step: Error ────────────────────────────────────────────────────────────

  if (step === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.captureContainer}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
          <Text style={styles.captureTitle}>Analysis Failed</Text>
          <Text style={styles.captureSubtitle}>Could not analyze the photo. Please try again.</Text>
          <View style={styles.captureActions}>
            <Pressable style={styles.captureBtn} onPress={() => imageUri && analyze(imageUri)}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.captureBtnText}>Retry</Text>
            </Pressable>
            <Pressable style={styles.captureBtnOutline} onPress={openCamera}>
              <Ionicons name="camera" size={20} color={colors.primary} />
              <Text style={styles.captureBtnOutlineText}>Take New Photo</Text>
            </Pressable>
            <Pressable style={styles.captureBtnOutline} onPress={openPicker}>
              <Ionicons name="images" size={20} color={colors.primary} />
              <Text style={styles.captureBtnOutlineText}>Choose from Gallery</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step: Review ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.reviewHeader}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.reviewTitle}>Food Analysis</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Image */}
        {imageUri && <Image source={{ uri: imageUri }} style={styles.reviewImage} resizeMode="cover" />}

        {/* Description */}
        <Text style={styles.foodDescription}>{result?.description}</Text>

        {/* Confidence badge */}
        {result && (
          <View style={[styles.confidenceBadge, { backgroundColor: CONFIDENCE_COLORS[result.confidence] + '22' }]}>
            <View style={[styles.confidenceDot, { backgroundColor: CONFIDENCE_COLORS[result.confidence] }]} />
            <Text style={[styles.confidenceText, { color: CONFIDENCE_COLORS[result.confidence] }]}>
              {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} confidence
            </Text>
          </View>
        )}

        {/* Suggestion */}
        {result?.suggestions && (
          <View style={styles.suggestionBox}>
            <Ionicons name="bulb-outline" size={14} color={colors.primary} />
            <Text style={styles.suggestionText}>{result.suggestions}</Text>
          </View>
        )}

        {/* Editable values */}
        <Text style={styles.sectionLabel}>Nutritional Estimate</Text>
        <Text style={styles.editHint}>Tap any value to adjust</Text>

        <View style={styles.valuesGrid}>
          <EditableValue label="Calories" value={editedValues.calories} unit="cal" color={colors.primary} onChange={(v) => updateValue('calories', v)} />
          <EditableValue label="Protein" value={editedValues.protein} unit="g" color={colors.protein} onChange={(v) => updateValue('protein', v)} />
          <EditableValue label="Carbs" value={editedValues.carbs} unit="g" color={colors.carbs} onChange={(v) => updateValue('carbs', v)} />
          <EditableValue label="Fat" value={editedValues.fat} unit="g" color={colors.fat} onChange={(v) => updateValue('fat', v)} />
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {hasEdited ? (
            <Pressable style={styles.primaryBtn} onPress={() => handleSave(true)}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Save with Changes</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={() => handleSave(false)}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Looks Right</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Editable Value ──────────────────────────────────────────────────────────

function EditableValue({ label, value, unit, color, onChange }: {
  label: string;
  value: string;
  unit: string;
  color: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={evStyles.container}>
      <Text style={evStyles.label}>{label}</Text>
      <View style={evStyles.inputRow}>
        <TextInput
          style={[evStyles.input, { color }]}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <Text style={evStyles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const evStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  label: { color: colors.textSecondary, fontSize: 11, marginBottom: 6, fontFamily: fonts.regular, letterSpacing: 0.3 },
  inputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  input: { fontSize: 22, fontWeight: '700', minWidth: 30, textAlign: 'center', padding: 0, fontFamily: fonts.bold, letterSpacing: 0.3 },
  unit: { color: colors.textTertiary, fontSize: 13, fontFamily: fonts.regular, letterSpacing: 0.3 },
});

// ─── Main Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Capture
  captureContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  backBtn: { position: 'absolute', top: 16, right: 16 },
  captureTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 8, fontFamily: fonts.bold, letterSpacing: 0.3 },
  captureSubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', fontFamily: fonts.regular, letterSpacing: 0.3 },
  captureActions: { width: '100%', gap: 10, marginTop: 16 },
  captureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, minHeight: 48,
  },
  captureBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: fonts.bold, letterSpacing: 0.3 },
  captureBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.primary, borderRadius: 12, paddingVertical: 14, minHeight: 48,
  },
  captureBtnOutlineText: { color: colors.primary, fontSize: 16, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Analyzing
  analyzingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  analyzingImage: { width: '100%', height: '60%', position: 'absolute', top: 0, opacity: 0.4 },
  analyzingOverlay: { alignItems: 'center', gap: 16 },
  analyzingText: { color: colors.textSecondary, fontSize: 16, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Review
  reviewContent: { padding: spacing.screenPadding },
  reviewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  reviewTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  reviewImage: { width: '100%', height: 220, borderRadius: 14, marginBottom: 16 },
  foodDescription: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: 10, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 12,
  },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceText: { fontSize: 12, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  suggestionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.primaryDim, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  suggestionText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19, fontFamily: fonts.regular, letterSpacing: 0.3 },
  sectionLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 2, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  editHint: { color: colors.textTertiary, fontSize: 12, marginBottom: 12, fontFamily: fonts.regular, letterSpacing: 0.3 },
  valuesGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },

  // Actions
  actionButtons: { gap: 10 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, minHeight: 48,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: fonts.bold, letterSpacing: 0.3 },
});
