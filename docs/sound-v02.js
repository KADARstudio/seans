/* Original PCM effects via one HTMLAudioElement. No microphone, external sounds,
   silent looping track, or assumption that scheduling means audible output. */
(function(root){
 'use strict';
 let enabled=false,player=null,played=0,epoch=0,lastError='',errorHandler=null;
 const sounds=new Map();
 const supported=()=>typeof root.Audio==='function';
 function wave(kind){
  if(sounds.has(kind))return sounds.get(kind);
  const rate=22050,length=kind==='final'?.72:kind==='slide'?.28:kind==='test'?.36:.18;
  const count=Math.ceil(rate*length),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
  const text=(at,v)=>{for(let i=0;i<v.length;i++)view.setUint8(at+i,v.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+count*2,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,count*2,true);
  let noise=0,seed=1729;
  for(let i=0;i<count;i++){
   const t=i/rate;let sample=0;
   if(kind==='slide'){
    seed=(1664525*seed+1013904223)>>>0;noise=noise*.82+((seed/4294967296)*2-1)*.18;
    sample=noise*Math.sin(Math.PI*t/length)*.55;
   }else{
    const notes=kind==='final'?[[523.25,0],[659.25,.11],[783.99,.22]]:kind==='test'?[[659.25,0],[880,.13]]:[[kind==='undo'?392:740,0]];
    for(const [f,start] of notes){const x=t-start;if(x<0)continue;const env=Math.min(1,x/.012)*Math.exp(-x*(kind==='final'?7:18));sample+=Math.sin(2*Math.PI*f*x)*env*.25;}
    sample*=Math.min(1,(length-t)/.025);
   }
   view.setInt16(44+i*2,Math.round(Math.max(-.8,Math.min(.8,sample))*32767),true);
  }
  let binary='';for(const byte of new Uint8Array(buffer))binary+=String.fromCharCode(byte);
  const uri='data:audio/wav;base64,'+root.btoa(binary);sounds.set(kind,uri);return uri;
 }
 function unlock(){
  if(!enabled||!supported())return false;
  try{
   // Explicit opt-in only: on Safari this requests media playback routing.
   if(root.navigator?.audioSession)root.navigator.audioSession.type='playback';
   if(!player){player=new root.Audio();player.preload='auto';player.setAttribute('playsinline','');player.volume=.8;}
   return true;
  }catch(e){lastError=String(e.message||e);return false;}
 }
 function play(kind='pick'){
  if(!enabled||!unlock())return Promise.resolve(false);
  const token=epoch;
  try{
   player.pause();player.src=wave(kind);player.currentTime=0;
   // Call play synchronously inside the click, not after an awaited animation.
   return Promise.resolve(player.play()).then(()=>{
    if(!enabled||token!==epoch){player.pause();return false;}
    played++;lastError='';return true;
   }).catch(e=>{
    if(e?.name==='AbortError')return false;
    lastError=String(e?.name||'AudioError');
    errorHandler?.('Nie udało się odtworzyć dźwięku. Dotknij „Test dźwięku” w filtrach.');return false;
   });
  }catch(e){lastError=String(e.message||e);errorHandler?.('Błąd odtwarzania dźwięku.');return Promise.resolve(false);}
 }
 function set(value){
  enabled=value===true;epoch++;
  if(!enabled){player?.pause();try{if(root.navigator?.audioSession)root.navigator.audioSession.type='auto';}catch{}}
 }
 root.SeansSound={set,play,unlock,supported,onError(fn){errorHandler=fn;},
  status:()=>({enabled,played,state:!player?'not-created':player.paused?'paused':'playing',lastError,currentTime:player?.currentTime||0,readyState:player?.readyState||0,backend:'html-audio'})};
})(window);
