'use strict';
// Controller and rendered-string checks in Node, with DOM stubs. NOT a browser or visual test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('../docs/core.js'),L=require('../docs/ledger-v02.js');
let now=0,passed=0;const calls={},nodes=new Map();
class Storage {constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function node(){return {innerHTML:'',textContent:'',style:{},dataset:{},disabled:false,
 classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this[k]=String(v);},getAttribute(k){return this[k];},removeAttribute(){},
 addEventListener(){},querySelector(){return node();},appendChild(){},append(){},remove(){},click(){},showModal(){},close(){},getBoundingClientRect(){return {left:0,top:0,width:160,height:240};},cloneNode(){return node();}};}
const doc={hidden:false,body:node(),querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll:()=>[],
 createElement:()=>node(),addEventListener:(k,fn)=>{(calls[k]??=[]).push(fn);}};
let soundOn=false;
const ctx={console,URL,Blob,Image:class{},crypto:require('node:crypto').webcrypto,Date,Map,Set,Promise,
 setTimeout,clearTimeout,setInterval:()=>0,performance:{now:()=>now},document:doc,
 localStorage:new Storage(),sessionStorage:new Storage(),location:{protocol:'https:',href:'https://example.test/index.html'},
 confirm:()=>true,matchMedia:()=>({matches:true}),scrollTo(){},addEventListener(){},
 fetch:()=>Promise.reject(Error('Network disabled in state tests')),AbortController,
 SeansCore:C,SeansLedger:L,SeansSound:{set(v){soundOn=v;},unlock(){},play(){},supported:()=>true}};
ctx.window=ctx;vm.createContext(ctx);
let source=fs.readFileSync(require.resolve('../docs/app.js'),'utf8');
assert.ok(source.endsWith('load();\n'));
source=source.slice(0,-'load();\n'.length);vm.runInContext(source,ctx);
const ev=x=>vm.runInContext(x,ctx);
const cat=JSON.parse(fs.readFileSync(require.resolve('../docs/catalog.json'),'utf8'));ctx.fixture=cat;
async function test(name,fn){await fn();passed++;console.log('PASS',name);}
function click(dataset){for(const fn of calls.click||[])fn({target:{closest:()=>({dataset,disabled:false})},preventDefault(){}});}
(async()=>{
 await test('Start uses actual PL catalogue and outputs two card templates',()=>{
  ev("catalogue=fixture;options.services=['netflix'];options.rounds=10;screen='home';start()");
  assert.equal(ev('game.completed'),0);assert.equal((nodes.get('#app').innerHTML.match(/data-side=/g)||[]).length,2);
 });
 await test('Pick updates actual controller and accounting',async()=>{await ev('move("pick",0)');assert.equal(ev('game.completed'),1);assert.equal(ev('session.events.length'),1);});
 await test('Concurrent picks cannot double-count',async()=>{ev('pending=0');const a=ev('move("pick",0)');await ev('move("pick",0)');await a;assert.equal(ev('game.completed'),2);});
 await test('Undo removes accounting event as well as game move',()=>{ev('undo()');assert.equal(ev('game.completed'),1);assert.equal(ev('session.events.length'),1);});
 await test('Seen does not increment decisions',async()=>{ev('pending=0');await ev('move("seen",1)');assert.equal(ev('game.completed'),1);assert.equal(ev('seen.length'),1);});
 await test('Undo seen restores list',()=>{ev('undo()');assert.equal(ev('seen.length'),0);});
 await test('Active time accrues',()=>{const before=ev('session.elapsedMs');now+=750;ev('tick()');assert.equal(ev('session.elapsedMs')-before,750);});
 await test('Hidden time is excluded',()=>{doc.hidden=true;ev('tick()');const before=ev('session.elapsedMs');now+=5000;ev('tick()');assert.equal(ev('session.elapsedMs'),before);doc.hidden=false;ev('tick()');});
 await test('Finish saves one genuine result',async()=>{await ev('finish()');assert.equal(ev('journal.length'),1);assert.equal(ev('journal[0].stats.decisions'),1);assert.equal(ev('journal[0].watchedAt'),null);});
 await test('Platform opening never means watching',()=>{click({open:ev('session.id')});assert.ok(ev('journal[0].openedAt'));assert.equal(ev('journal[0].watchedAt'),null);});
 await test('Explicit watch and score are stored separately',()=>{click({watched:ev('session.id')});click({rate:ev('session.id'),score:'4'});assert.ok(ev('journal[0].watchedAt'));assert.equal(ev('journal[0].score'),4);});
 await test('Continue reuses session id and preserves same-film rating',async()=>{click({action:'more'});ev('pending=0');await ev('move("pick",0)');await ev('finish()');assert.equal(ev('journal.length'),1);assert.equal(ev('journal[0].score'),4);assert.equal(ev('journal[0].stats.decisions'),2);});
 await test('Undo final restores prior journal instead of duplicating it',()=>{ev('undo()');assert.equal(ev('journal.length'),1);assert.equal(ev('game.done'),false);});
 await test('Saved list still works',()=>{click({action:'save'});assert.equal(ev('saved.length'),1);});
 await test('Library renders separate chosen/opened/watched labels',()=>{const html=ev('libraryHTML()');for(const t of ['wybranych','otwartych na platformie','obejrzanych','Twoja ocena'])assert.ok(html.includes(t));});
 await test('Result statistics render from the ledger',()=>{const html=ev('resultStatsHTML()');assert.ok(html.includes('aktywnego wyboru'));assert.ok(!html.includes('dopasowanie'));});
 await test('Own portable data passes import validation',()=>{assert.equal(ev("validBackup({app:'Seans',version:2,options,seen,saved,journal,audioEnabled})"),true);});
 await test('Malformed data is rejected',()=>assert.equal(ev("validBackup({app:'Seans',version:2,journal:[]})"),false));
 await test('Script and credential-bearing URLs rejected',()=>{assert.equal(ev("safeURL('javascript:alert(1)')"),'');assert.equal(ev("safeURL('https://u:p@example.com')"),'');});
 await test('Markup in titles is escaped',()=>assert.equal(ev("esc('<script>test</script>')"),'&lt;script&gt;test&lt;/script&gt;'));
 await test('Persistence contains session metadata, not full journal per undo',()=>{ev('persist()');const data=JSON.parse(ctx.sessionStorage.getItem('seans.prototype.v1.session'));assert.ok(data.session);assert.ok(data.history.every(h=>!('journal' in h)));});
 await test('Storage failure does not crash and triggers warning',()=>{const real=ctx.localStorage.setItem;ctx.localStorage.setItem=()=>{throw Error('Quota');};assert.equal(ev("write('test',{})"),false);assert.equal(ev('storageWarning'),true);ctx.localStorage.setItem=real;});
 await test('User can toggle sound with persisted preference',()=>{click({action:'sound'});assert.equal(soundOn,true);assert.equal(ctx.localStorage.getItem('seans.prototype.v1.sound.v02'),'true');click({action:'sound'});assert.equal(soundOn,false);});
 await test('Legacy resume declares incomplete measurements',()=>{ev('resume={pool:[...activeMovies.values()],game:C.clone(game),options,fetchedAt:gameFetchedAt};game=null;session=null');click({action:'resume'});assert.equal(ev('session.completeData'),false);assert.equal(ev('L.summary(session,game).decisions'),0);});
 console.log(JSON.stringify({suite:'app-state (Node DOM stubs; not browser)',passed,failed:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
