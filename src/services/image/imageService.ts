import { supabase, uploadImage as supabaseUpload } from '../../lib/supabase';

// There is deliberately no third-party fallback host here. The previous
// version fell back to ImgBB with a key compiled into the public bundle, which
// put every anonymous user's photo on a public image host that /privacy never
// named (pre-launch-audit.md A.1). An anonymous image now travels inline in
// the request body as a data URL — /api/ai-proxy already accepts and
// transcribes that form — and a signed-in upload that fails is a failure the
// composer reports, not one it papers over.

export interface ImageUploadResponse {
  success: boolean;
  url: string;
  path?: string;
  error?: string;
}

// Convert base64 to File object
function base64ToFile(base64: string, filename: string = 'image.png'): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// Convert URL to base64
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Upload to Supabase Storage
async function uploadToSupabase(base64Image: string, userId: string, purpose: string = 'chat'): Promise<ImageUploadResponse> {
  try {
    const file = base64ToFile(base64Image);
    const result = await supabaseUpload(file, userId);

    if (result) {
      // Also save the image reference in the database
      await supabase.from('user_images').insert({
        user_id: userId,
        storage_path: result.path,
        public_url: result.url,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        purpose: purpose,
      });

      return {
        success: true,
        url: result.url,
        path: result.path,
      };
    }

    throw new Error('Failed to upload to Supabase Storage');
  } catch (error) {
    console.error('Supabase upload error:', error);
    return {
      success: false,
      url: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Main upload function. Signed-in users only: anonymous images stay inline.
export async function uploadImage(base64Image: string, userId?: string | null, purpose: string = 'chat'): Promise<ImageUploadResponse> {
  if (!userId) {
    return { success: false, url: '', error: 'Sign in to upload images' };
  }
  return uploadToSupabase(base64Image, userId, purpose);
}

// Upload a generated image from URL to Supabase
export async function uploadGeneratedImage(imageUrl: string, userId: string): Promise<ImageUploadResponse> {
  try {
    // Fetch the image and convert to base64
    const base64 = await urlToBase64(imageUrl);

    // Upload to Supabase with 'generated' purpose
    return await uploadToSupabase(base64, userId, 'generated');
  } catch (error) {
    console.error('Failed to upload generated image:', error);
    return {
      success: false,
      url: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Process AI message content to upload generated images and replace URLs
export async function processGeneratedImages(content: string, userId: string): Promise<string> {
  // Match proxy image URLs
  const proxyImageRegex = /!\[Generated Image\]\((\/api\/image\?[^)]+)\)/g;

  let processedContent = content;
  let match;

  // Find all proxy image URLs
  const matches: { original: string; url: string }[] = [];
  while ((match = proxyImageRegex.exec(content)) !== null) {
    matches.push({ original: match[0], url: match[1] });
  }

  // Upload each image and replace URL
  for (const m of matches) {
    try {
      // Build full URL for fetching
      const fullUrl = window.location.origin + m.url;
      const uploadResult = await uploadGeneratedImage(fullUrl, userId);

      if (uploadResult.success) {
        // Replace proxy URL with permanent Supabase URL
        processedContent = processedContent.replace(
          m.original,
          `![Generated Image](${uploadResult.url})`
        );
      }
    } catch (error) {
      console.error('Failed to process generated image:', error);
    }
  }

  return processedContent;
}

// Delete image from Supabase Storage
export async function deleteImage(path: string, userId?: string): Promise<boolean> {
  if (!userId || !path) return false;

  try {
    const { error } = await supabase.storage.from('user-images').remove([path]);
    if (!error) {
      // Also remove from database
      await supabase.from('user_images').delete().eq('storage_path', path);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

// Get user's uploaded images
export async function getUserImages(userId: string, purpose?: string): Promise<{ url: string; path: string; created_at: string }[]> {
  try {
    let query = supabase
      .from('user_images')
      .select('public_url, storage_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (purpose) {
      query = query.eq('purpose', purpose);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(img => ({
      url: img.public_url,
      path: img.storage_path,
      created_at: img.created_at,
    }));
  } catch (error) {
    console.error('Error fetching user images:', error);
    return [];
  }
}

export default uploadImage;
