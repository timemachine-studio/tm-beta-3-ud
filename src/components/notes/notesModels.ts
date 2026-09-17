import type { NotesAIModel } from '../../services/ai/notesAiService';

/* The three minds Notes can ask, as the composer and the panel present
   them — the chat's three, on the chat's routes (api/_lib/personaRoutes.ts). */
export const NOTES_MODELS: { key: NotesAIModel; name: string; detail: string; hue: string }[] = [
  { key: 'air', name: 'TimeMachine Air', detail: 'Fast, everyday edits', hue: '168 85 247' },
  { key: 'girlie', name: 'TimeMachine Girlie', detail: 'Same edits, bestie energy', hue: '236 72 153' },
  { key: 'pro', name: 'TimeMachine PRO', detail: 'Thinks longer on the hard ones', hue: '34 211 238' },
];

export function modelName(model: NotesAIModel) {
  return NOTES_MODELS.find((m) => m.key === model)?.name ?? 'TimeMachine Air';
}
