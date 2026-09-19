/** Server-authoritative two-person sessions. No network, credentials or film metadata. */
export class RoomError extends Error {
  constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new RoomError(code, status); };
const copy = x => JSON.parse(JSON.stringify(x));
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FILM = /^tm\d{1,14}$/;
export const SERVICES = ['netflix', 'prime', 'disney', 'max', 'apple', 'sky'];
export const TTL_MS = 4 * 60 * 60 * 1000;
function alive(room, now) {
  if (!room || room.closed || now >= room.expiresAt) fail('ROOM_UNAVAILABLE', 410);
}
function member(room, user) {
  const key = room.host === user ? 'a' : room.guest === user ? 'b' : null;
  if (!key) fail('ROOM_UNAVAILABLE', 404);
  return key;
}
function randomized(ids, seed) {
  // Deterministic but separate order, never used as a security primitive.
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  const result = ids.slice();
  for (let i = result.length - 1; i; i--) {
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    const j = (n >>> 0) % (i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function player(ids, seed, seq = 0) {
  const deck = randomized(ids, seed);
  return { seq, deck, cursor: 2, pair: deck.slice(0, 2), champion: null, streak: 0,
    decisions: 0, events: [], vetoes: [], history: [], done: false, answers: {}, next: false, lastOp: null };
}
function beginRound(room) {
  const start = (room.round - 1) * 13, ids = room.bank.slice(start, start + 13);
  if (ids.length < 2) { room.phase = 'exhausted'; return; }
  room.pool = ids;
  room.players = {
    a: player(ids, `${room.id}/${room.round}/a`, (room.players?.a?.seq || 0) + 1),
    b: player(ids, `${room.id}/${room.round}/b`, (room.players?.b?.seq || 0) + 1)
  };
  room.phase = 'picking'; room.candidates = []; room.winner = null;
}
export function createRoom({ id, user, inviteHash, ids, services, catalogueAt }, now = Date.now()) {
  if (!UUID.test(id) || !UUID.test(user) || !/^[0-9a-f]{64}$/.test(inviteHash)) fail('INVALID_REQUEST', 400);
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 104 || ids.some(x => typeof x !== 'string' || !FILM.test(x)) || new Set(ids).size !== ids.length) fail('INVALID_POOL', 400);
  if (!Array.isArray(services) || !services.length || services.some(x => !SERVICES.includes(x))) fail('INVALID_SERVICES', 400);
  if (typeof catalogueAt !== 'string' || !Number.isFinite(Date.parse(catalogueAt)) || catalogueAt.length > 40) fail('INVALID_CATALOGUE', 400);
  return { version: 1, id, host: user, guest: null, inviteHash, createdAt: now, expiresAt: now + TTL_MS,
    closed: false, revision: 0, phase: 'waiting', round: 1, bank: ids.slice(), pool: [], players: {},
    services: [...new Set(services)], catalogueAt, candidates: [], winner: null, matchedAt: null };
}
export function joinRoom(source, user, inviteHash, now = Date.now()) {
  alive(source, now);
  if (!UUID.test(user)) fail('INVALID_REQUEST', 400);
  if (source.host === user || source.guest === user) return copy(source);
  if (source.guest || source.inviteHash !== inviteHash) fail('INVITE_UNAVAILABLE', 404);
  const room = copy(source); room.guest = user; room.inviteHash = null; beginRound(room); room.revision++;
  return room;
}
export function shortlist(room) {
  const [a, b] = [room.players.a, room.players.b];
  const veto = new Set([...a.vetoes, ...b.vetoes]);
  function score(p, id) {
    let w = 0, l = 0;
    for (const e of p.events) if (e.type === 'pick') { if (e.winner === id) w++; if (e.loser === id) l++; }
    return (w + 1) / (w + l + 2); // Smoothed observations, NOT a match probability.
  }
  return room.pool.filter(id => !veto.has(id)).map(id => {
    const s1 = score(a, id), s2 = score(b, id);
    return { id, worst: Math.min(s1, s2), sum: s1 + s2 };
  }).sort((x, y) => y.worst - x.worst || y.sum - x.sum || x.id.localeCompare(y.id)).slice(0, 3).map(x => x.id);
}
function finishPicks(room) {
  if (!room.players.a.done || !room.players.b.done) return;
  room.candidates = shortlist(room);
  room.phase = room.candidates.length ? 'confirming' : 'no-match';
}
function remember(p) {
  p.history.push(copy({ cursor: p.cursor, pair: p.pair, champion: p.champion, streak: p.streak,
    decisions: p.decisions, events: p.events, vetoes: p.vetoes, done: p.done }));
  if (p.history.length > 30) p.history.shift();
}
function draw(p) { return p.deck[p.cursor++] || null; }
function finish(p) { p.done = p.pair.filter(Boolean).length < 2; }
export function command(source, user, input, now = Date.now()) {
  alive(source, now); const role = member(source, user);
  if (!input || !UUID.test(input.opId || '') || !Number.isInteger(input.seq) || typeof input.type !== 'string') fail('INVALID_REQUEST', 400);
  const prev = source.players[role];
  if (prev?.lastOp === input.opId) return copy(source); // Same request after a lost acknowledgement.
  if (input.type === 'close') {
    const room = copy(source); room.closed = true; room.phase = 'closed'; room.bank = []; room.pool = [];
    room.players = {}; room.candidates = []; room.inviteHash = null; room.winner = null; room.matchedAt = null; room.services = []; room.catalogueAt = null; room.revision++; return room;
  }
  if (!prev || prev.seq !== input.seq || input.round !== source.round) fail('STALE_STATE');
  if (source.phase === 'matched' || source.phase === 'exhausted') fail('ROUND_FINISHED');
  const room = copy(source), p = room.players[role];
  if (['pick', 'veto', 'skip', 'undo'].includes(input.type)) {
    if (room.phase !== 'picking') fail('ROUND_FINISHED');
    if (input.type === 'undo') {
      if (!p.history.length) fail('NOTHING_TO_UNDO');
      Object.assign(p, p.history.pop());
    } else {
      if (p.done) fail('ROUND_FINISHED');
      if (!['skip'].includes(input.type) && !p.pair.includes(input.filmId)) fail('INVALID_FILM', 400);
      remember(p);
      if (input.type === 'pick') {
        const side = p.pair.indexOf(input.filmId), loser = p.pair[1 - side];
        p.events.push({ type: 'pick', winner: input.filmId, loser }); p.decisions++;
        p.streak = p.champion === input.filmId ? p.streak + 1 : 1; p.champion = input.filmId;
        p.pair[1 - side] = draw(p);
      } else if (input.type === 'veto') {
        const side = p.pair.indexOf(input.filmId); p.vetoes.push(input.filmId);
        if (p.champion === input.filmId) { p.champion = null; p.streak = 0; }
        p.pair[side] = draw(p);
      } else {
        p.vetoes.push(...p.pair.filter(Boolean)); p.pair = [draw(p), draw(p)]; p.champion = null; p.streak = 0;
      }
      finish(p);
    }
    finishPicks(room);
  } else if (input.type === 'answer') {
    if (room.phase !== 'confirming' || !room.candidates.includes(input.filmId) || typeof input.accept !== 'boolean') fail('INVALID_ANSWER', 400);
    p.answers[input.filmId] = input.accept;
    const other = room.players[role === 'a' ? 'b' : 'a'];
    if (input.accept === true && other.answers[input.filmId] === true) {
      room.phase = 'matched'; room.winner = input.filmId; room.matchedAt = now;
    } else if (room.candidates.every(id => p.answers[id] === false || other.answers[id] === false)) {
      room.phase = 'no-match';
    }
  } else if (input.type === 'again') {
    if (room.phase !== 'no-match') fail('INVALID_PHASE');
    p.next = true;
    if (room.players.a.next && room.players.b.next) { room.round++; beginRound(room); }
  } else fail('INVALID_COMMAND', 400);
  // beginRound replaces both player states; update the current one after that.
  room.players[role].seq++; room.players[role].lastOp = input.opId; room.revision++;
  return room;
}
export function snapshot(room, user, now = Date.now()) {
  alive(room, now); const role = member(room, user), p = room.players[role];
  const other = room.players[role === 'a' ? 'b' : 'a'];
  return { id: room.id, revision: room.revision, role, phase: room.phase, round: room.round,
    createdAt: room.createdAt, expiresAt: room.expiresAt, joined: !!room.guest, services: room.services,
    catalogueAt: room.catalogueAt, pool: room.pool.slice(), candidates: room.candidates.slice(),
    winner: room.winner, matchedAt: room.matchedAt,
    self: p ? { seq: p.seq, pair: p.pair, champion: p.champion, streak: p.streak, decisions: p.decisions,
      remaining: Math.max(0, p.deck.length - Math.min(p.cursor, p.deck.length)), goal: p.deck.length - 1,
      done: p.done, canUndo: !!p.history.length && room.phase === 'picking', answers: p.answers, next: p.next,
      lastOp: p.lastOp, defeated: p.events.filter(e => e.winner === room.winner).length } : null,
    // Deliberately exclude opponent's pair, votes, answers, vetoes and user identifier.
    other: { done: !!other?.done, decisions: other?.decisions || 0, next: !!other?.next }
  };
}
