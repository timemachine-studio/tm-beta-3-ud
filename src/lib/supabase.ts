import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://etpehiyzlkhknzceizar.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  throw new Error('Supabase anon key is not set. Please set VITE_SUPABASE_ANON_KEY in your environment variables.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Helper to get public URL for storage
export const getStoragePublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// Upload image to Supabase Storage
export const uploadImage = async (
  file: File,
  userId?: string
): Promise<{ url: string; path: string } | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = userId ? `${userId}/${fileName}` : `anonymous/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const publicUrl = getStoragePublicUrl('user-images', filePath);
    return { url: publicUrl, path: filePath };
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};

// Delete image from Supabase Storage
export const deleteImage = async (path: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage.from('user-images').remove([path]);
    return !error;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

export default supabase;
