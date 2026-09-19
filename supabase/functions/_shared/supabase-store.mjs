import { RoomError } from './room-engine.mjs';
/** All calls execute only in the server function. The service key never enters the client. */
export function supabaseStore(url, serviceKey, fetcher = fetch) {
  async function rpc(name, data) {
    const response = await fetcher(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json'
    }, body: JSON.stringify(data), signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      let reason = ''; try { reason = (await response.json()).message; } catch {}
      if (reason === 'ROOM_LIMIT') throw new RoomError('ROOM_LIMIT', 429);
      if (reason === 'DUPLICATE_ROOM') throw new RoomError('TRY_AGAIN', 409);
      throw new RoomError('SERVICE_UNAVAILABLE', 503);
    }
    return response.json();
  }
  return { get: id => rpc('seans_store_get', { p_id: id }),
    create: state => rpc('seans_store_create', { p_state: state }),
    cas: (id, revision, state) => rpc('seans_store_cas', { p_id: id, p_revision: revision, p_state: state }) };
}
