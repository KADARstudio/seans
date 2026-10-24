// Test adapters only. Production uses the service-only Supabase/PostgREST adapter.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RoomError } from '../supabase/functions/_shared/room-engine.mjs';
const run=promisify(execFile), copy=x=>x?structuredClone(x):null;
export function memoryStore(){const rows=new Map();return {rows,async get(id){return copy(rows.get(id));},async create(s){if(rows.has(s.id))throw new RoomError('TRY_AGAIN');rows.set(s.id,copy(s));return true;},async cas(id,rev,s){if(rows.get(id)?.revision!==rev)return false;rows.set(id,copy(s));return true;}};}
export function postgresStore(){
 const url=process.env.TEST_DATABASE_URL;if(!url)throw Error('TEST_DATABASE_URL required');const u=new URL(url);
 if(!['localhost','127.0.0.1'].includes(u.hostname)||!u.pathname.endsWith('_test'))throw Error('Test database must be local and end in _test');
 const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
 async function query(sql,role='service_role'){
  try{const {stdout}=await run('psql',['-X','-qAt',url,'-v','ON_ERROR_STOP=1','-c',`set role ${role}; ${sql}`],{maxBuffer:2*1024*1024});return stdout.trim();}
  catch(e){if(e.stderr?.includes('ROOM_LIMIT'))throw new RoomError('ROOM_LIMIT',429);if(e.stderr?.includes('DUPLICATE_ROOM'))throw new RoomError('TRY_AGAIN');throw e;}
 }
 return {query,async get(id){const s=await query(`select public.seans_store_get(${quote(id)}::uuid)`);return s?JSON.parse(s):null;},
  async create(s){return (await query(`select public.seans_store_create(${quote(JSON.stringify(s))}::jsonb)`))==='t';},
  async cas(id,rev,s){return (await query(`select public.seans_store_cas(${quote(id)}::uuid,${Number(rev)},${quote(JSON.stringify(s))}::jsonb)`))==='t';}};
}
