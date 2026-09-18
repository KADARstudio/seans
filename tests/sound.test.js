'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test');
const source=fs.readFileSync(require.resolve('../docs/sound-v02.js'),'utf8');
function setup(reject=false){const players=[];class AudioMock{
 constructor(){this.paused=true;this.currentTime=0;this.readyState=4;players.push(this);}setAttribute(){}pause(){this.paused=true;}
 play(){if(reject)return Promise.reject(Object.assign(Error('blocked'),{name:'NotAllowedError'}));this.paused=false;this.currentTime=.01;return Promise.resolve();}}
 const ctx={Audio:AudioMock,ArrayBuffer,DataView,Uint8Array,Map,Promise,Math,navigator:{audioSession:{type:'auto'}},btoa:s=>Buffer.from(s,'binary').toString('base64')};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return{S:ctx.SeansSound,ctx,players};}
test('Off by default, no audio element or playback channel before opt-in',()=>{const{S,players,ctx}=setup();assert.equal(S.status().enabled,false);assert.equal(players.length,0);assert.equal(ctx.navigator.audioSession.type,'auto');});
test('Muted play does nothing',async()=>{const{S,players}=setup();assert.equal(await S.play(),false);assert.equal(players.length,0);});
test('Explicit play uses a nonzero PCM WAV data source and media session',async()=>{const{S,players,ctx}=setup();S.set(true);assert.equal(await S.play('test'),true);assert.equal(S.status().played,1);assert.equal(ctx.navigator.audioSession.type,'playback');const b=Buffer.from(players[0].src.split(',')[1],'base64');assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WAVE');assert.ok(b.length>1000);assert.ok(b.subarray(44).some(v=>v!==0));});
test('Reuse the authorized audio element for all sounds',async()=>{const{S,players}=setup();S.set(true);for(const k of ['test','pick','slide','final','undo'])await S.play(k);assert.equal(players.length,1);assert.equal(S.status().played,5);});
test('Mute pauses media and releases exclusive audio session',async()=>{const{S,players,ctx}=setup();S.set(true);await S.play();S.set(false);assert.equal(players[0].paused,true);assert.equal(ctx.navigator.audioSession.type,'auto');assert.equal(await S.play(),false);});
test('Rejected playback is not reported as success and surfaces a message',async()=>{const{S}=setup(true);let error='';S.onError(e=>error=e);S.set(true);assert.equal(await S.play(),false);assert.equal(S.status().played,0);assert.equal(S.status().lastError,'NotAllowedError');assert.ok(error);});
test('Unsupported environment is optional, not an application crash',async()=>{const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);ctx.SeansSound.set(true);assert.equal(ctx.SeansSound.supported(),false);assert.equal(await ctx.SeansSound.play(),false);});
