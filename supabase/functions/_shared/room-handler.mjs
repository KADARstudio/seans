import { RoomError, UUID, createRoom, joinRoom, command, snapshot } from './room-engine.mjs';
export async function secretHash(secret) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
/** Adapters allow real PostgreSQL storage in tests and Supabase without a second game engine. */
export function makeHandler({ authenticate, store, allowedOrigins, now = Date.now }) {
  const response = (data, status, origin) => new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': origin || 'null', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'X-Content-Type-Options': 'nosniff'
  }});
  return async request => {
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins.includes(origin)) return response({ error: 'ORIGIN_DENIED' }, 403, null);
    if (request.method === 'OPTIONS') return response({}, 200, origin);
    if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
    try {
      const user = await authenticate(request.headers.get('authorization') || '');
      if (!user || !UUID.test(user)) throw new RoomError('SESSION_REQUIRED', 401);
      if (Number(request.headers.get('content-length') || 0) > 12000) throw new RoomError('PAYLOAD_TOO_LARGE', 413);
      // Stream with a hard limit; a missing Content-Length must not bypass the bound.
      const reader = request.body?.getReader(); let bytes = 0, raw = '', decoder = new TextDecoder();
      if (!reader) throw new RoomError('INVALID_REQUEST', 400);
      while (true) { const {done, value} = await reader.read(); if (done) break; bytes += value.length;
        if (bytes > 12000) { await reader.cancel(); throw new RoomError('PAYLOAD_TOO_LARGE', 413); }
        raw += decoder.decode(value, {stream: true}); }
      raw += decoder.decode();
      let body; try { body = JSON.parse(raw); } catch { throw new RoomError('INVALID_REQUEST', 400); }
      if (!body || !UUID.test(body.roomId || '')) throw new RoomError('INVALID_REQUEST', 400);
      if (body.action === 'create') {
        if (!/^[0-9a-f]{64}$/.test(body.invite || '')) throw new RoomError('INVALID_REQUEST', 400);
        let existing = await store.get(body.roomId);
        if (existing) {
          if (existing.host !== user || existing.closed || existing.expiresAt <= now()) throw new RoomError('ROOM_UNAVAILABLE', 409);
          return response({ room: snapshot(existing, user, now()) }, 200, origin);
        }
        const room = createRoom({ id: body.roomId, user, inviteHash: await secretHash(body.invite), ids: body.ids,
          services: body.services, catalogueAt: body.catalogueAt }, now());
        await store.create(room); return response({ room: snapshot(room, user, now()) }, 200, origin);
      }
      for (let attempt = 0; attempt < 6; attempt++) {
        const room = await store.get(body.roomId);
        if (!room) throw new RoomError('ROOM_UNAVAILABLE', 404);
        let next;
        if (body.action === 'join') {
          if (!/^[0-9a-f]{64}$/.test(body.invite || '')) throw new RoomError('INVITE_UNAVAILABLE', 404);
          next = joinRoom(room, user, await secretHash(body.invite), now());
        } else if (body.action === 'read') return response({ room: snapshot(room, user, now()) }, 200, origin);
        else if (body.action === 'command') next = command(room, user, body.command, now());
        else throw new RoomError('INVALID_REQUEST', 400);
        if (next.revision === room.revision || await store.cas(room.id, room.revision, next)) {
          if (next.closed) return response({ closed: true }, 200, origin);
          return response({ room: snapshot(next, user, now()) }, 200, origin);
        }
      }
      throw new RoomError('TRY_AGAIN', 409);
    } catch (error) {
      const expected = error instanceof RoomError;
      // Never log payloads, invitation URLs, user tokens, choices or raw database errors.
      return response({ error: expected ? error.code : 'SERVICE_UNAVAILABLE' }, expected ? error.status : 503, origin);
    }
  };
}
