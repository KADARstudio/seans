const assert=require('node:assert/strict');
const C=require('../docs/core.js');
let tests=0;
function test(name,fn){fn();tests++;console.log('PASS',name);}
const pool=n=>Array.from({length:n},(_,i)=>({id:'m'+i,title:'Movie '+i,offers:[{provider:i%2?'prime':'netflix'}],genres:[{id:'scf'}],rating:7,year:2020,runtime:110}));
test('Winner stays on the selected side',()=>{let g=C.createGame(pool(10),5);g=C.choose(g,1);assert.equal(g.pair[1],'m1');assert.equal(g.pair[0],'m2');g=C.choose(g,1);assert.equal(g.pair[1],'m1');assert.equal(g.pair[0],'m3');g=C.choose(g,0);assert.equal(g.pair[0],'m3');assert.equal(g.champion,'m3');});
test('Exactly 50 duels',()=>{let g=C.createGame(pool(70),50);for(let i=0;i<50;i++)g=C.choose(g,i%2);assert.equal(g.completed,50);assert.equal(g.done,true);assert.ok(g.champion);});
test('Last two films finish safely',()=>{let g=C.createGame(pool(2),50);assert.equal(g.goal,1);g=C.choose(g,0);assert.equal(g.champion,'m0');assert.equal(g.done,true);});
test('Replace viewed favourite resets champion',()=>{let g=C.createGame(pool(6),5);g=C.choose(g,0);g=C.replace(g,0);assert.equal(g.champion,null);assert.equal(g.wins,0);assert.ok(g.pair[0]);});
test('Skip both with no movies left',()=>{const g=C.skipBoth(C.createGame(pool(2),50));assert.equal(g.done,true);assert.equal(g.champion,null);});
test('Continue adds 10 comparisons',()=>{let g=C.createGame(pool(30),10);for(let i=0;i<10;i++)g=C.choose(g,0);g=C.continueGame(g,10);assert.equal(g.goal,20);assert.equal(g.done,false);});
test('Exact provider, genre, rating, duration and seen filters',()=>{const p=pool(6);const o={services:['netflix'],genre:'scf',runtime:120,rating:7,year:2010};assert.deepEqual(C.filterMovies(p,o,['m2']).map(x=>x.id),['m0','m4']);p[0].runtime=null;assert.deepEqual(C.filterMovies(p,o,['m2']).map(x=>x.id),['m4']);});
test('No mutation: undo snapshots remain intact',()=>{const g=C.createGame(pool(5),3),before=JSON.stringify(g);C.choose(g,1);C.skipBoth(g);C.replace(g,0);assert.equal(JSON.stringify(g),before);});
test('No duplicate challengers in 100 tournaments',()=>{for(let t=0;t<100;t++){let g=C.createGame(C.shuffle(pool(60)),50);const shown=new Set(g.pair);while(!g.done){const side=Math.random()<.5?0:1;const old=g.pair[side];g=C.choose(g,side);assert.equal(g.pair[side],old);const next=g.pair[1-side];if(next){assert.ok(!shown.has(next));shown.add(next);}}}});
console.log(JSON.stringify({passed:tests,failed:0}));
