-- Run this script in your Supabase SQL Editor

-- 1. Create the user_music table
CREATE TABLE IF NOT EXISTS public.user_music (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_name TEXT NOT NULL,
    style TEXT NOT NULL,
    lyrics TEXT NOT NULL,
    cover_prompt TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on user_music table
ALTER TABLE public.user_music ENABLE ROW LEVEL SECURITY;

-- Create policies for user_music table
CREATE POLICY "Users can insert their own music" ON public.user_music FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own music" ON public.user_music FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own music" ON public.user_music FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own music" ON public.user_music FOR DELETE USING (auth.uid() = user_id);

-- 2. Create the music-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('music-assets', 'music-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for music-assets bucket
CREATE POLICY "Users can view their own music assets" ON storage.objects FOR SELECT USING (bucket_id = 'music-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert their own music assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'music-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own music assets" ON storage.objects FOR UPDATE USING (bucket_id = 'music-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own music assets" ON storage.objects FOR DELETE USING (bucket_id = 'music-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public can view music-assets" ON storage.objects FOR SELECT USING (bucket_id = 'music-assets');
