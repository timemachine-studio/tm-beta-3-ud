import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveAdminUser } from './_lib/adminGuard.js';
import { AI_PERSONAS } from './ai-proxy.js';

export interface AdminPreset {
  id: string;
  label: string;
  prompt: string;
}

// Persona prompts only — model name and provider are never included.
function buildPersonaPresets(): AdminPreset[] {
  const presets: AdminPreset[] = [];
  for (const [key, persona] of Object.entries(AI_PERSONAS)) {
    if ('systemPromptsByHeatLevel' in persona && persona.systemPromptsByHeatLevel) {
      for (const [level, prompt] of Object.entries(persona.systemPromptsByHeatLevel)) {
        presets.push({ id: `${key}-${level}`, label: `${persona.name} — Heat ${level}`, prompt });
      }
    } else if ('systemPrompt' in persona && persona.systemPrompt) {
      presets.push({ id: key, label: persona.name, prompt: persona.systemPrompt });
    }
  }
  return presets;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await resolveAdminUser(req);
  if (!admin) return res.status(200).json({ isAdmin: false });

  return res.status(200).json({ isAdmin: true, presets: buildPersonaPresets() });
}