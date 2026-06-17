const { AndroidConfig } = require('@expo/config-plugins');

// Google Play "Photo and Video Permissions" policy compliance.
//
// MarchBuddy only needs occasional photo access for FoodSnap, which uses the Android
// Photo Picker (expo-image-picker `launchImageLibraryAsync`) and shares via expo-sharing.
// Neither requires media or storage permissions. expo-image-picker still merges
// READ/WRITE_EXTERNAL_STORAGE (and older builds added READ_MEDIA_*) into the manifest at
// prebuild, which Google Play rejects as "not directly related to your app's core purpose".
//
// withBlockedPermissions injects `tools:node="remove"` for each, stripping them from the
// final merged AndroidManifest. Camera permission is intentionally kept (FoodSnap "Take Photo").
module.exports = (config) =>
  AndroidConfig.Permissions.withBlockedPermissions(config, [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ]);
