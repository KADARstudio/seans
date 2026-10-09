import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createRoom,joinRoom,command,snapshot} from '../supabase/functions/_shared/room-engine.mjs';
const A=randomUUID(),B=randomUUID(),hash='f'.repeat(64);
const fresh=ids=>createRoom({id:randomUUID(),user:A,inviteHash:hash,ids,services:['netflix'],catalogueAt:new Date().toISOString()});
function action(r,u,type,fields={}){return command(r,u,{type,opId:randomUUID(),seq:snapshot(r,u).self.seq,round:r.round,...fields});}
test('Closing a matched room erases winner and metadata',()=>{let r=joinRoom(fresh(['tm1','tm2']),B,hash);for(const u of [A,B])r=action(r,u,'pick',{filmId:snapshot(r,u).self.pair[0]});const filmId=r.candidates[0];for(const u of [A,B])r=action(r,u,'answer',{filmId,accept:true});assert.equal(r.phase,'matched');r=action(r,A,'close');assert.equal(r.winner,null);assert.equal(r.matchedAt,null);assert.equal(r.catalogueAt,null);assert.deepEqual(r.services,[]);});
test('Array coercion cannot masquerade as a film identifier',()=>{assert.throws(()=>fresh([['tm1'],'tm2']),/INVALID_POOL/);});
