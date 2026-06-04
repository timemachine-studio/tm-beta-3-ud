import { supabase } from '../../lib/supabase';

export interface SavedMusic {
  id: string;
  user_id: string;
  song_name: string;
  style: string;
  lyrics: string;
  cover_prompt: string;
  audio_url: string;
  image_url: string;
  created_at: string;
}

export async function uploadGeneratedMusic(
  userId: string,
  songName: string,
  style: string,
  lyrics: string,
  coverPrompt: string,
  audioBlob: Blob,
  imageBlob: Blob
): Promise<SavedMusic | null> {
  try {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    
    // 1. Upload Image
    const imagePath = `${userId}/${timestamp}-${randomString}.jpg`;
    const { error: imageError } = await supabase.storage
      .from('music-assets')
      .upload(imagePath, imageBlob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (imageError) {
      console.error('Error uploading music cover:', imageError);
      return null;
    }
    
    const { data: imageData } = supabase.storage.from('music-assets').getPublicUrl(imagePath);

    // 2. Upload Audio
    const audioPath = `${userId}/${timestamp}-${randomString}.mp3`;
    const { error: audioError } = await supabase.storage
      .from('music-assets')
      .upload(audioPath, audioBlob, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (audioError) {
      console.error('Error uploading music audio:', audioError);
      return null;
    }
    
    const { data: audioData } = supabase.storage.from('music-assets').getPublicUrl(audioPath);

    // 3. Save to database
    const { data: dbData, error: dbError } = await supabase
      .from('user_music')
      .insert({
        user_id: userId,
        song_name: songName,
        style: style,
        lyrics: lyrics,
        cover_prompt: coverPrompt,
        audio_url: audioData.publicUrl,
        image_url: imageData.publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving music metadata to db:', dbError);
      return null;
    }

    return dbData as SavedMusic;
  } catch (error) {
    console.error('Error in uploadGeneratedMusic:', error);
    return null;
  }
}
