/* Original, quiet synthesized effects. No recordings, external audio or microphone. */
(function(root){
  'use strict';
  let context=null, enabled=false, played=0;
  const supported=()=>Boolean(root.AudioContext||root.webkitAudioContext);
  function unlock(){
    if(!enabled||!supported())return;
    try{
      if(!context)context=new(root.AudioContext||root.webkitAudioContext)();
      if(context.state==='suspended')context.resume().catch(()=>{});
    }catch{context=null;}
  }
  function tone(frequency,time,length,gain=.038,type='sine'){
    if(!context||context.state!=='running')return;
    const o=context.createOscillator(),g=context.createGain();
    o.type=type;o.frequency.setValueAtTime(frequency,time);
    g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(gain,time+.012);
    g.gain.exponentialRampToValueAtTime(.0001,time+length);
    o.connect(g);g.connect(context.destination);o.start(time);o.stop(time+length+.02);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function whoosh(time){
    const n=Math.ceil(context.sampleRate*.1),buffer=context.createBuffer(1,n,context.sampleRate),d=buffer.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/n);
    const src=context.createBufferSource(),g=context.createGain(),filter=context.createBiquadFilter();
    src.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(1600,time);
    filter.frequency.exponentialRampToValueAtTime(550,time+.1);g.gain.value=.018;
    src.connect(filter);filter.connect(g);g.connect(context.destination);src.start(time);
    src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect();};
  }
  function play(kind='pick'){
    if(!enabled)return;unlock();if(!context||context.state!=='running')return;
    try{const t=context.currentTime+.008;
      if(kind==='final'){tone(523.25,t,.22,.03);tone(659.25,t+.1,.25,.025);tone(783.99,t+.2,.42,.022);}
      else if(kind==='slide')whoosh(t);
      else if(kind==='undo')tone(392,t,.09,.025);
      else{tone(740,t,.075,.035);tone(1110,t+.018,.05,.01);}
      played++;
    }catch{/* Audio is optional; an audio error never blocks a decision. */}
  }
  function set(value){enabled=value===true;if(enabled)unlock();else if(context?.state==='running')context.suspend().catch(()=>{});}
  root.SeansSound={set,play,unlock,supported,status:()=>({enabled,state:context?.state||'not-created',played})};
})(window);
