import type React from 'react';
import { ImagePlus, Code, Music, HeartPulse, FileText } from 'lucide-react';
export type PlusMenuOption = 'upload-photos' | 'upload-file' | 'web-coding' | 'music-compose' | 'tm-healthcare';

export const plusMenuItems: { key: PlusMenuOption; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'upload-photos', label: 'Upload Photos', icon: ImagePlus },
  { key: 'upload-file', label: 'Upload Files', icon: FileText },
  { key: 'web-coding', label: 'Web Coding', icon: Code },
  { key: 'music-compose', label: 'Music Compose', icon: Music },
  { key: 'tm-healthcare', label: 'TM Healthcare', icon: HeartPulse },
];
