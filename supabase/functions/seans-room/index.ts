// This function belongs ONLY to the dedicated Seans Supabase project.
// verify_jwt is disabled at the platform layer; this handler always verifies
// the user's bearer token through Auth before exposing any room operation.
import { makeHandler } from '../_shared/room-handler.mjs';
import { supabaseStore } from '../_shared/supabase-store.mjs';
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const origins = (Deno.env.get('SEANS_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
if (!url || !serviceKey || !publicKey || !origins.length) throw new Error('Seans configuration missing');
if (origins.includes('*') || origins.some(s => s.includes('githack'))) throw new Error('Use an owned origin, not a shared preview host');
Deno.serve(makeHandler({ allowedOrigins: origins, store: supabaseStore(url, serviceKey),
  async authenticate(authorization: string) {
    if (!/^Bearer [A-Za-z0-9_.-]{20,4096}$/.test(authorization)) return null;
    const result = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: authorization }, signal: AbortSignal.timeout(8000) });
    if (!result.ok) return null;
    const user = await result.json();
    return user.is_anonymous === true ? user.id : null;
  }
}));
