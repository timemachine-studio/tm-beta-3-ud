import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';

/* A signed-in shell without a Supabase account, for working on the
   signed-in UI on a checkout that has no real backend. Two locks: Vite must
   be serving in dev mode, and the checkout's .env must opt in. A production
   build compiles `import.meta.env.DEV` to false, so the whole branch is dead
   code there whatever the env file says. Nothing is authorised on it — every
   server call still needs a real JWT and will fail, which is the point. */

export const DEV_MOCK_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_USER === '1';

const NOW = '2026-09-16T00:00:00.000Z';

export const DEV_MOCK_USER = {
  id: '00000000-0000-4000-8000-000000000dev',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'dev@timemachine.local',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: NOW,
} as unknown as User;

export const DEV_MOCK_SESSION = {
  access_token: 'dev-mock',
  refresh_token: 'dev-mock',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: DEV_MOCK_USER,
} as unknown as Session;

export const DEV_MOCK_PROFILE: Profile = {
  id: DEV_MOCK_USER.id,
  email: 'dev@timemachine.local',
  phone: null,
  nickname: 'Dev',
  about_me: null,
  avatar_url: null,
  is_pro: true,
  gender: null,
  birth_date: null,
  rate_limit_overrides: null,
  default_theme: null,
  last_persona: 'default',
  created_at: NOW,
  updated_at: NOW,
};
