/* Transport to the dedicated Seans room service, without an SDK or third-party scripts. */
(function (root) {
  'use strict';
  class ClientError extends Error { constructor(code) { super(code); this.code = code; } }
  function createClient(config) {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!config?.enabled || !config.supabaseUrl || !config.publishableKey) throw new ClientError('BACKEND_NOT_CONFIGURED');
    const url = new URL(config.supabaseUrl);
    if (location.origin !== config.siteOrigin || (!local && (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)))) throw new ClientError('UNSAFE_HOST');
    if (/githack/.test(location.hostname) || config.publishableKey.startsWith('sb_secret_')) throw new ClientError('UNSAFE_HOST');
    if (!local && !config.publishableKey.startsWith('sb_publishable_')) {
      try { if (JSON.parse(atob(config.publishableKey.split('.')[1])).role !== 'anon') throw Error(); }
      catch { throw new ClientError('UNSAFE_HOST'); }
    }
    const base = url.origin, key = config.publishableKey, storageKey = 'seans.duo.v04.auth.' + url.hostname;
    let session = null, authPending = null;
    try { session = JSON.parse(localStorage.getItem(storageKey)); } catch {}
    async function request(path, body, bearer) {
      const response = await fetch(base + path, { method: 'POST', headers: {
        apikey: key, 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
      }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000), referrerPolicy: 'no-referrer', cache: 'no-store' });
      let data; try { data = await response.json(); } catch { throw new ClientError('SERVICE_UNAVAILABLE'); }
      if (!response.ok) throw new ClientError(data.error?.code || (typeof data.error === 'string' ? data.error : data.code) || (response.status === 429 ? 'ROOM_LIMIT' : 'SERVICE_UNAVAILABLE'));
      return data;
    }
    async function ensureAuth() {
      if (session?.access_token && session.expires_at > Date.now()/1000 + 90) return session.access_token;
      if (authPending) return authPending;
      authPending = (async () => {
        let data;
        try { data = session?.refresh_token ? await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token }) : await request('/auth/v1/signup', {}); }
        catch (e) { if (session?.refresh_token) throw new ClientError('SESSION_EXPIRED'); throw e; }
        if (!data.access_token || !data.refresh_token) throw new ClientError('SESSION_REQUIRED');
        session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at || Date.now()/1000 + data.expires_in };
        try { localStorage.setItem(storageKey, JSON.stringify(session)); } catch { throw new ClientError('STORAGE_UNAVAILABLE'); }
        return session.access_token;
      })().finally(() => authPending = null);
      return authPending;
    }
    return { async call(body) { return request('/functions/v1/seans-room', body, await ensureAuth()); },
      forget() { session = null; localStorage.removeItem(storageKey); } };
  }
  root.SeansRoomClient = { create: createClient, ClientError };
})(window);
