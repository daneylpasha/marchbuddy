import { File } from 'expo-file-system';

/**
 * Convert a local image URI to a base64 string.
 * Returns null if conversion fails.
 */
export async function imageUriToBase64(uri: string): Promise<string | null> {
  try {
    const file = new File(uri);
    const base64 = await file.base64();
    return base64;
  } catch (e) {
    console.error('[imageUtils] Failed to convert image to base64:', e);
    return null;
  }
}
