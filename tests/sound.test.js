'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../docs/sound-v02.js'),'utf8');
let created=0,oscillators=0,buffers=0,passed=0;
const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});
class AudioMock {
 constructor(){created++;this.state='running';this.currentTime=0;this.sampleRate=48000;this.destination={};}
 resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
 createOscillator(){oscillators++;return{frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}
 createGain(){return{gain:param(),connect(){},disconnect(){}};}
 createBuffer(c,n){buffers++;return{getChannelData:()=>new Float32Array(n)};}
 createBufferSource(){return{connect(){},disconnect(){},start(){}};}
 createBiquadFilter(){return{frequency:param(),connect(){},disconnect(){}};}
}
const ctx={AudioContext:AudioMock};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
const S=ctx.SeansSound;
function test(name,fn){fn();passed++;console.log('PASS',name);}
test('Default sound is off and creates no audio context',()=>{assert.equal(S.status().enabled,false);assert.equal(created,0);});
test('Muted calls schedule no sound',()=>{S.play('final');assert.equal(oscillators,0);});
test('Enabling audio initializes context',()=>{S.set(true);assert.equal(created,1);});
test('Choice schedules two short tones',()=>{S.play('pick');assert.equal(oscillators,2);});
test('Card slide schedules original generated noise',()=>{S.play('slide');assert.equal(buffers,1);});
test('Final schedules three tones',()=>{S.play('final');assert.equal(oscillators,5);});
test('Muting suspends output',()=>{S.set(false);S.play('pick');assert.equal(S.status().state,'suspended');assert.equal(oscillators,5);});
test('Missing Web Audio never blocks the application',()=>{const x={};x.window=x;vm.createContext(x);vm.runInContext(source,x);x.SeansSound.set(true);x.SeansSound.play('pick');assert.equal(x.SeansSound.supported(),false);});
console.log(JSON.stringify({suite:'sound scheduling (API stubs; not listening test)',passed,failed:0}));
