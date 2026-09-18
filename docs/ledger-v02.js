/* Local accounting. Choosing, opening a platform and watching are separate events. */
(function(root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const uuid = () => root.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  function create(baseCompleted = 0, completeData = true) {
    return {id:uuid(), startedAt:new Date().toISOString(), elapsedMs:0, events:[], baseCompleted, completeData};
  }
  function summary(session, game) {
    const events=session?.events || [];
    const picks=events.filter(e=>e.type==='pick');
    return {decisions:Math.max(0,game.completed-(session?.baseCompleted||0)),
      defeated:new Set(picks.filter(e=>e.winner===game.champion).map(e=>e.loser).filter(Boolean)).size,
      elapsedMs:Math.max(0,Math.round(session?.elapsedMs||0)),
      skippedPairs:events.filter(e=>e.type==='skip').length,
      markedSeen:events.filter(e=>e.type==='seen').length,
      measured:session?.completeData===true,
      chosen:events.some(e=>(e.type==='pick'||e.type==='accept')&&e.winner===game.champion)};
  }
  function result(session,game,movie,services,fetchedAt) {
    if(!session||!movie)return null;
    const stats=summary(session,game);
    if(!stats.chosen)return null;
    return {id:session.id,chosenAt:new Date().toISOString(),startedAt:session.startedAt,
      movie:copy(movie),services:services.slice(),fetchedAt,stats,events:copy(session.events),
      openedAt:null,watchedAt:null,score:null};
  }
  function upsert(rows,entry) {
    if(!entry)return rows.slice();
    const old=rows.find(r=>r.id===entry.id), next={...entry};
    if(old?.movie.id===entry.movie.id){
      for(const key of ['chosenAt','openedAt','watchedAt','score','followupDismissed'])
        next[key]=old[key]??next[key];
    }
    return [next,...rows.filter(r=>r.id!==entry.id)].slice(0,200);
  }
  function aggregate(rows) {
    const measured=rows.filter(r=>r.stats?.measured);
    return {chosen:rows.length,opened:rows.filter(r=>r.openedAt).length,watched:rows.filter(r=>r.watchedAt).length,
      decisions:rows.reduce((n,r)=>n+(r.stats?.decisions||0),0),
      averageMs:measured.length?Math.round(measured.reduce((n,r)=>n+r.stats.elapsedMs,0)/measured.length):null,
      measured:measured.length};
  }
  function duration(ms) {
    if(!Number.isFinite(ms))return '—';
    const s=Math.max(0,Math.round(ms/1000));
    return s<60?`${s} s`:s<3600?`${Math.floor(s/60)} min ${String(s%60).padStart(2,'0')} s`:`${Math.floor(s/3600)} godz. ${Math.floor(s%3600/60)} min`;
  }
  function plural(n,one,few,many){return n===1?one:n%10>=2&&n%10<=4&&!(n%100>=12&&n%100<=14)?few:many;}
  root.SeansLedger={create,summary,result,upsert,aggregate,duration,plural,copy};
  if(typeof module!=='undefined')module.exports=root.SeansLedger;
})(typeof window!=='undefined'?window:globalThis);
