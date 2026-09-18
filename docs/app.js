'use strict';
const C=window.SeansCore, L=window.SeansLedger, S=window.SeansSound, $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=x=>{try{const u=new URL(String(x||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const STORE='seans.prototype.v1';
let storageWarning=false;
function read(key,fallback,session=false){try{const store=session?window.sessionStorage:window.localStorage;return JSON.parse(store.getItem(STORE+'.'+key))??fallback;}catch{return fallback;}}
function write(key,value,session=false){try{const store=session?window.sessionStorage:window.localStorage;store.setItem(STORE+'.'+key,JSON.stringify(value));return true;}catch{storageWarning=true;return false;}}
let options=read('options',{services:[],rounds:25,genre:'',runtime:'',rating:'',year:''});
let seen=read('seen',[]), saved=read('saved',[]), catalogue=null, activeMovies=new Map(), game=null, history=[], screen='loading', error='', offlineCopy=false, pending=0, toastTimer;
let gameFetchedAt=null, session=null, journal=read('journal.v02',[]), libraryTab='history', moving=false;
let clockAnchor=null, audioEnabled=read('sound.v02',false)===true, lastPersistence=0;
if(!Array.isArray(journal))journal=[];
if(!Array.isArray(seen))seen=[];
if(!Array.isArray(saved))saved=[];
if(!options||!Array.isArray(options.services))options={services:[],rounds:25,genre:'',runtime:'',rating:'',year:''};
options.rounds=[10,25,50].includes(Number(options.rounds))?Number(options.rounds):25;
S.set(audioEnabled);
const reduceMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const genreNames={act:'Akcja i przygoda',ani:'Animacja',cmy:'Komedia',crm:'Kryminał',doc:'Dokumentalny',drm:'Dramat',eur:'Kino europejskie',fml:'Familijny',fnt:'Fantasy',hrr:'Horror',hst:'Historyczny',msc:'Muzyczny',rma:'Romans',scf:'Science fiction',spt:'Sportowy',trl:'Thriller',war:'Wojenny',wsn:'Western'};
const genreName=g=>genreNames[g.id]||g.name;
function currentDate(){return game?(gameFetchedAt||catalogue.fetchedAt):catalogue?.fetchedAt;}
let resume=read('session',null,true);
const pretty={netflix:'NETFLIX',prime:'prime video',disney:'Disney+',max:'HBO Max',apple:'Apple TV',sky:'SkyShowtime'};
function dateText(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'brak daty';}
function ageHours(){return catalogue?(Date.now()-new Date(currentDate()).getTime())/3600000:Infinity;}
function isStale(){return offlineCopy||ageHours()>3;}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function movie(id){return activeMovies.get(id)||catalogue?.movies.find(m=>m.id===id)||saved.find(m=>m.id===id);}
function selectedOffers(m){return(m?.offers||[]).filter(o=>options.services.includes(o.provider));}
function tags(m){return selectedOffers(m).map(o=>`<span class="provider-tag">${esc(o.name)}</span>`).join('');}
function meta(m){return[m.year,m.runtime?`${m.runtime} min`:null,m.rating?`★ ${Number(m.rating).toFixed(1)} IMDb`:null].filter(Boolean).join(' · ');}
function image(m,cls='poster'){const u=safeURL(m.poster);return u?`<img class="${cls}" src="${esc(u)}" alt="Plakat: ${esc(m.title)}" loading="eager" decoding="async" referrerpolicy="no-referrer">`:'';}
function poster(m,badge=''){return`<div class="poster-wrap"><span class="poster-fallback">${esc(m.title)}</span>${image(m)}${badge}</div>`;}
function currentPool(){return catalogue?C.filterMovies(catalogue.movies,options,seen):[];}
function statusHTML(){if(!catalogue)return'';return`<div class="status ${isStale()?'stale':''}"><span class="dot"></span><div>${offlineCopy?'Zapisana kopia katalogu. ':''}${ageHours()>3?'Dane mogą być nieaktualne. ':''}Oferty PL sprawdzone ${dateText(currentDate())}.<br>${catalogue.movies.length} filmów w puli · datowana kopia katalogu.</div></div>`;}
function footer(){return`${storageWarning?'<span class="notice">Przeglądarka nie zapisała części danych. Pobierz kopię w „Moich seansach”.</span>':''}<span>Wybieraj filmy, nie kolejne menu.</span><span>Dostępność: <a href="https://www.justwatch.com/pl" target="_blank" rel="noopener noreferrer">JustWatch</a> · Polska</span>`;}
function saveOptions(){write('options',options);}
function persist(){if(!game)return;write('session',{game,options,pool:[...activeMovies.values()],fetchedAt:currentDate(),session,history},true);resume=read('session',null,true);}
function tick(){const now=performance.now();if(clockAnchor!==null&&session)session.elapsedMs+=Math.max(0,now-clockAnchor);clockAnchor=screen==='duel'&&game&&!game.done&&!document.hidden?now:null;}
function saveJournal(){write('journal.v02',journal);}
function recordResult(){const entry=L.result(session,game,movie(game.champion),options.services,currentDate());journal=L.upsert(journal,entry);saveJournal();}
function play(kind){if(audioEnabled)S.play(kind);}
function announce(text){$('#announcer').textContent=text;}
function audioButton(){const b=$('[data-action="sound"]');if(!b)return;b.setAttribute('aria-pressed',String(audioEnabled));b.setAttribute('aria-label',audioEnabled?'Wyłącz dźwięki':'Włącz dźwięki');b.title=audioEnabled?'Dźwięki włączone':'Dźwięki wyłączone';b.innerHTML=audioEnabled?'♫':'♪<span class="mute-mark"></span>';}
function filmStatus(r){return r.watchedAt?'Obejrzany':r.openedAt?'Otwarty na platformie':'Wybrany';}
function followupHTML(){const r=journal.find(x=>x.openedAt&&!x.watchedAt&&!x.followupDismissed);return r?`<section class="followup"><div class="eyebrow">OSTATNI WYBÓR</div><p>Udało się obejrzeć <strong>${esc(r.movie.title)}</strong>?</p><div class="row-actions"><button class="secondary" data-watched="${esc(r.id)}">Tak, obejrzany</button><button class="text-btn" data-dismiss="${esc(r.id)}">Nie teraz</button></div></section>`:'';}

function remember(){history.push({game:C.clone(game),seen:seen.slice(),events:L.copy(session.events),entry:L.copy(journal.find(r=>r.id===session.id)||null)});if(history.length>100)history.shift();}
function draw(){const views={home:homeHTML,duel:duelHTML,winner:winnerHTML,library:libraryHTML,loading:()=>`<div class="loader"><div class="spinner"></div><h2>Szukamy czegoś na wieczór.</h2><p>Pobieram katalog filmów dostępnych w polskich abonamentach.</p></div>`,error:errorHTML};$('#app').innerHTML=(views[screen]||homeHTML)();$('#footer').innerHTML=footer();audioButton();document.querySelectorAll('img.poster').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));}
function homeHTML(){const pool=currentPool();const genres=new Map();catalogue.movies.forEach(m=>m.genres.forEach(g=>genres.set(g.id,genreName(g))));const select=(id,label,items)=>`<label class="field"><span>${label}</span><select data-option="${id}" aria-label="${label}">${items.map(([value,name])=>`<option value="${esc(value)}" ${String(options[id])===String(value)?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;return`${followupHTML()}<div class="home-layout"><section class="hero"><div class="eyebrow"><span class="dot"></span>WIECZÓR BEZ PRZEWIJANIA</div><h1>Mniej szukania.<br><span>Więcej oglądania.</span></h1><p>Dwa filmy. Jeden wybór. Zwycięzca zostaje, a Ty coraz lepiej wiesz, na co masz dziś ochotę.</p>${statusHTML()}${resume?.game&&!game?`<button class="secondary" style="margin-top:20px" data-action="resume">↶ Wznów ostatni wybór</button>`:''}</section><section><div class="section-label">Gdzie oglądasz?<small>Wybierz swoje abonamenty</small></div><div class="service-grid">${catalogue.providers.map(p=>{const n=catalogue.movies.filter(m=>m.offers.some(o=>o.provider===p.id)).length;return`<button class="service" data-service="${esc(p.id)}" aria-pressed="${options.services.includes(p.id)}" aria-label="${esc(p.name)}"><span class="check">✓</span><strong>${esc(pretty[p.id]||p.name)}</strong><small>${n} filmów w puli</small></button>`;}).join('')}</div><div class="filter-grid">${select('genre','Dzisiejszy klimat',[['','Każdy gatunek'],...[...genres.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pl'))])}${select('runtime','Ile masz czasu?',[['','Bez limitu'],[100,'Do 100 minut'],[120,'Do 2 godzin'],[150,'Do 2,5 godziny']])}${select('rating','Ocena IMDb',[['','Każda ocena'],[6,'Co najmniej 6,0'],[7,'Co najmniej 7,0'],[8,'Co najmniej 8,0']])}${select('year','Rok premiery',[['','Wszystkie lata'],[2000,'Od 2000 roku'],[2010,'Od 2010 roku'],[2020,'Od 2020 roku']])}</div><div class="section-label">Ile pojedynków?<small>Możesz skończyć wcześniej</small></div><div class="segments">${[10,25,50].map(n=>`<button class="segment" data-rounds="${n}" aria-pressed="${Number(options.rounds)===n}">${n}</button>`).join('')}</div><div class="start-wrap"><button class="primary" data-action="start" ${pool.length<2?'disabled':''}>${!options.services.length?'Zaznacz swoje platformy':pool.length<2?'Za mało filmów — zmień filtry':'Znajdźmy film'} <span class="arrow">↗</span></button><p class="help-line">${options.services.length?`${pool.length} pasujących filmów · `:''}Bez konta. Bez wypożyczania. Tylko abonamenty.</p>${seen.length?`<button class="text-btn" data-action="clear-seen">Przywróć obejrzane (${seen.length})</button>`:''}</div></section></div>`;}
function cardHTML(id,side){const m=movie(id);if(!m)return'';const champion=game.champion===id;const badges=`<div class="poster-badge">${champion?'<span class="badge champ">✦ TWÓJ FAWORYT</span>':'<span></span>'}${m.rating?`<span class="badge rating">★ ${Number(m.rating).toFixed(1)}</span>`:''}</div>`;return`<article class="movie ${champion?'is-champion':''}" data-movie="${esc(id)}" data-side="${side}"><button class="poster-button" data-pick="${side}" aria-label="Wybieram: ${esc(m.title)}">${poster(m,badges)}</button><div class="streak ${champion?'active':''}">${champion?`✦ ${game.wins} ${L.plural(game.wins,'wygrana z rzędu','wygrane z rzędu','wygranych z rzędu')}`:'Nowy pretendent'}</div><h2>${esc(m.title)}</h2><div class="movie-meta">${esc([m.year,m.runtime?m.runtime+' min':null].filter(Boolean).join(' · '))}<br>${esc(m.genres.slice(0,2).map(g=>genreName(g)).join(' / '))}</div><div class="provider-tags">${tags(m)}</div><button class="primary pick" data-pick="${side}">Ten wybieram <span>↗</span></button><div class="movie-tools"><button class="text-btn" data-seen="${side}">✓ Widziałem/am</button><button class="text-btn" data-detail="${esc(id)}">Opis ⓘ</button></div></article>`;}
function duelHTML(){return`<div class="duel-top"><span>TWÓJ FILM NA DZIŚ</span><span><strong>${game.completed}</strong> / ${game.goal} decyzji</span></div><div class="progress"><div style="width:${Math.round(game.completed/game.goal*100)}%"></div></div><div class="duel-title"><h1>Na który masz ochotę?</h1><p>${game.champion?'Twój faworyt zostaje. Nowy film musi go pokonać.':'Kliknij plakat lub przycisk. Wybierz intuicyjnie.'}</p></div><div class="duel">${cardHTML(game.pair[0],0)}<span class="versus">VS</span>${cardHTML(game.pair[1],1)}</div><div class="duel-actions"><button class="text-btn" data-action="undo" ${history.length?'':'disabled'}>↶ Cofnij</button><button class="text-btn" data-action="skip">Żaden z nich</button><button class="secondary finish" data-action="finish" ${game.champion?'':'disabled'}>Mam film ✓</button></div><div class="duel-end">${isStale()?statusHTML():''}<p class="help-line">${Math.max(0,game.deck.length-game.cursor)} nowych przeciwników w tej puli · <button class="text-btn" data-action="home">Zmień ustawienia</button></p></div>`;}
function winnerHTML(){const m=movie(game?.champion);if(!m)return`<div class="error-box"><h2>Przejrzeliśmy tę pulę.</h2><p>Nie został żaden kandydat. Zmień filtry lub platformy i spróbuj z nową pulą.</p><button class="primary" data-action="home">Zmień ustawienia</button></div>`;const offers=selectedOffers(m);return`<section class="winner"><div class="eyebrow" style="justify-content:center">✦ KONIEC SZUKANIA</div><h1>${L.summary(session,game).chosen?'Mamy film.':'Został jeden film.'}</h1><p class="winner-intro">${game.completed} ${L.plural(game.completed,'decyzja','decyzje','decyzji')} — wybór należy do Ciebie.</p>${poster(m)}<h2>${esc(m.title)}</h2><div class="movie-meta">${esc(meta(m))}</div><div class="provider-tags">${tags(m)}</div>${resultStatsHTML()}<p class="summary">${esc(m.description||'Opis tego filmu nie jest dostępny w źródle.')}</p>${isStale()?`<div class="notice">Dane z ${dateText(currentDate())}. Sprawdź dostępność przed seansem.</div>`:''}${!L.summary(session,game).chosen?'<p class="notice">Ten film został po pomijaniu innych. Potwierdź go, zanim zapiszemy wynik.</p><button class="primary" data-action="accept">Wybieram ten film ✓</button>':''}<div class="watch-links">${offers.map(o=>`<a class="primary" data-open="${esc(session.id)}" href="${esc(safeURL(o.url))}" target="_blank" rel="noopener noreferrer">▶ Otwórz ${esc(o.name)} <span>↗</span></a>`).join('')}</div><p class="help-line">Oferta w abonamencie według danych z ${dateText(currentDate())}.<br>Platforma może poprosić o zalogowanie. Dostępność nie jest gwarantowana.</p>${chosenActionsHTML()}<div class="winner-actions"><button class="secondary" data-action="save">${saved.some(s=>s.id===m.id)?'♥ Zapisany':'♡ Zapisz na później'}</button><button class="secondary" data-action="more" ${game.pair.every(Boolean)?'':'disabled'}>Jeszcze 10 par</button></div><div class="winner-bottom"><a class="inline-link" href="${esc(safeURL(m.url))}" target="_blank" rel="noopener noreferrer">Sprawdź w JustWatch ↗</a><button class="text-btn" data-action="home">Wybierz od nowa</button><button class="text-btn" data-action="undo" ${history.length?'':'disabled'}>↶ Cofnij decyzję</button></div></section>`;}
function savedHTML(){return`<section class="library"><div class="eyebrow">TWOJA LISTA</div><h1>Na kolejny wieczór.</h1><p class="help-line" style="text-align:left">Zapisane tylko w tej przeglądarce. ${seen.length} oznaczonych jako obejrzane.</p>${saved.length?saved.map(m=>`<div class="library-row">${image(m,'library-poster')}<div class="info"><h3>${esc(m.title)}</h3><p>${esc(meta(m))}</p><a class="inline-link" href="${esc(safeURL(m.url))}" target="_blank" rel="noopener noreferrer">Aktualna dostępność ↗</a></div><button class="text-btn" data-remove="${esc(m.id)}">Usuń</button></div>`).join(''):'<div class="error-box"><p>Tu trafią filmy zapisane po finale pojedynków.</p></div>'}<button class="primary" style="margin-top:23px" data-action="home">Wróć do wybierania</button></section>`;}
function errorHTML(){return`<div class="error-box"><div class="eyebrow">POŁĄCZENIE Z KATALOGIEM</div><h2>Nie udało się pobrać filmów.</h2><p>${esc(error||'Sprawdź połączenie z internetem i spróbuj ponownie.')}</p><p>Nie pokazuję wymyślonej listy ani filmów z innego kraju.</p><button class="primary" data-action="reload">Spróbuj ponownie ↻</button></div>`;}
async function getJSON(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
function validCatalogue(c){return c?.version===1&&c.country==='PL'&&c.monetization==='FLATRATE'&&Array.isArray(c.providers)&&c.providers.length>0&&Array.isArray(c.movies)&&c.movies.length>=2&&Number.isFinite(Date.parse(c.fetchedAt))&&c.movies.every(m=>typeof m.id==='string'&&typeof m.title==='string'&&Array.isArray(m.genres)&&Array.isArray(m.offers)&&m.offers.length>0&&m.url?.startsWith('https://www.justwatch.com/pl/'));}
async function load(){
  screen='loading';draw();offlineCopy=false;
  const endpoints=[];
  if(location.protocol.startsWith('http'))endpoints.push(new URL('catalog.json',location.href).href);
  const boot=c=>{catalogue=c;write('catalogue',c);options.services=options.services.filter(id=>c.providers.some(p=>p.id===id));screen='home';draw();wireImages();};
  if(window.SEANS_SEED&&validCatalogue(window.SEANS_SEED)){
    offlineCopy=true;boot(window.SEANS_SEED);
    // A bundled catalogue is labelled a saved copy, never as a successful new fetch.
    getJSON(endpoints[0]).then(c=>{if(validCatalogue(c)&&Date.parse(c.fetchedAt)>=Date.parse(catalogue.fetchedAt)){
      catalogue=c;offlineCopy=false;write('catalogue',c);if(screen==='home')draw();
    }}).catch(()=>{});return;
  }
  let data;
  for(const url of endpoints){try{const c=await getJSON(url);if(validCatalogue(c)){data=c;break;}}catch(e){console.warn('Catalogue unavailable',e.message);}}
  if(!data){const c=read('catalogue',null);if(validCatalogue(c)){data=c;offlineCopy=true;}}
  if(!data){screen='error';error='Źródło danych lub połączenie jest chwilowo niedostępne. Nie pokazujemy wymyślonych ofert.';draw();return;}
  boot(data);
}
function showDetail(id){const m=movie(id);if(!m)return;$('#sheet-content').innerHTML=`${image(m,'detail-poster')}<h2>${esc(m.title)}</h2><p>${esc(meta(m))}</p><div class="provider-tags">${tags(m)}</div><p class="description">${esc(m.description||'Brak opisu w bazie.')}</p><div class="source-block"><a class="inline-link" href="${esc(safeURL(m.url))}" target="_blank" rel="noopener noreferrer">Film w JustWatch ↗</a><p class="small">Oferty PL sprawdzone ${dateText(currentDate())}. Ocena pochodzi z IMDb, przekazana przez JustWatch.</p></div>`;$('#sheet').showModal();}
function about(){const detail=catalogue?`${catalogue.movies.length} filmów; pobrano ${dateText(currentDate())}.`:'Katalog nie został jeszcze pobrany.';$('#sheet-content').innerHTML=`<div class="eyebrow">SEANS · WERSJA 0.2.1</div><h2>Dwa filmy.<br>Jeden wieczór.</h2><p>W każdym pojedynku wybrany film zostaje po tej samej stronie. Zmieniamy wyłącznie przeciwnika. To prosty turniej, nie model AI i nie obietnica idealnej rekomendacji.</p><h3>Skąd są filmy?</h3><p>Źródło: <a href="https://www.justwatch.com/pl" target="_blank" rel="noopener noreferrer">JustWatch</a>. Pobieramy próbkę do 100 popularnych filmów na platformę i sprawdzamy polskie oferty w abonamencie. Nie pobieramy całych katalogów. Pomijamy wypożyczanie, zakup oraz dodatkowe kanały Amazon.</p><p>${esc(detail)} Ta niezależna wersja czyta katalog z własnego hostingu. Automatyczne pobieranie nowych ofert nie jest jeszcze włączone. Data pokazuje ostatnie udane pobranie, nie gwarancję dostępności w chwili odtwarzania.</p><h3>To prototyp, nie partner JustWatch</h3><p>Integracja jest nieoficjalna, do prywatnego testu bez monetyzacji. Przed publikacją komercyjną trzeba uzgodnić licencję danych i przejść na wspierany interfejs. Plakaty i znaki należą do ich właścicieli.</p><h3>Prywatność</h3><p>Nie ma logowania, reklam ani naszej analityki. Ustawienia, wybory, czasy sesji, oceny i historia zapisują się tylko w tej przeglądarce. Kliknięcie platformy nie oznacza obejrzenia filmu. Możesz pobrać kopię lub usunąć dane. Nie synchronizujemy danych między urządzeniami. Hosting i serwery plakatów otrzymują zwykłe żądania sieciowe, w tym adres IP. Nie łączymy się z kontami Netflix ani innych platform.</p><h3>Na ekranie telefonu</h3><p>Otwórz stronę w Safari, wybierz Udostępnij, a potem „Do ekranu głównego”. To aplikacja przeglądarkowa, nie instalacja z App Store.</p><button class="secondary" data-action="export">Pobierz kopię danych</button><button class="secondary" style="margin-top:10px" data-action="import">Wczytaj kopię danych</button><button class="secondary danger" style="margin-top:10px" data-action="clear-data">Usuń moje lokalne dane</button>`;$('#sheet').showModal();}

function resultStatsHTML(){
  const s=L.summary(session,game);
  if(!s.chosen)return '';
  return `<div class="result-stats"><div><strong>${esc(L.duration(s.elapsedMs))}</strong><span>${s.measured?'aktywnego wyboru':'zmierzone od wznowienia'}</span></div><div><strong>${s.decisions}</strong><span>${L.plural(s.decisions,'decyzja','decyzje','decyzji')}</span></div><div><strong>${s.defeated}</strong><span>pokonanych przez ten film</span></div></div><p class="help-line">${s.measured?'Czas nie obejmuje pobytu poza widoczną kartą aplikacji.':'Sesję rozpoczęto w starszej wersji. Wcześniejszych statystyk nie znamy.'}</p>`;
}
function scoreHTML(r){
  return `<div class="score"><span>Twoja ocena</span><div role="group" aria-label="Ocena filmu ${esc(r.movie.title)}">${[1,2,3,4,5].map(n=>`<button class="star ${r.score>=n?'lit':''}" data-rate="${esc(r.id)}" data-score="${n}" aria-pressed="${r.score===n}" aria-label="Oceń ${n} na 5">★</button>`).join('')}</div></div>`;
}
function chosenActionsHTML(){
  const r=journal.find(x=>x.id===session?.id);if(!r)return '';
  return `<div class="watch-state"><span class="state-chip ${r.watchedAt?'watched':''}">${filmStatus(r)}</span>${r.watchedAt?scoreHTML(r):`<button class="text-btn" data-watched="${esc(r.id)}">✓ Oznacz jako obejrzany</button>`}</div>`;
}
function libraryHTML(){
  const a=L.aggregate(journal);
  const tabs=`<div class="library-tabs" role="tablist" aria-label="Moje filmy"><button role="tab" data-tab="history" aria-selected="${libraryTab==='history'}">Historia (${journal.length})</button><button role="tab" data-tab="saved" aria-selected="${libraryTab==='saved'}">Na później (${saved.length})</button></div>`;
  let content;
  if(libraryTab==='saved'){
    content=saved.length?saved.map(m=>`<div class="library-row">${image(m,'library-poster')}<div class="info"><h3>${esc(m.title)}</h3><p>${esc(meta(m))}</p><a class="inline-link" href="${esc(safeURL(m.url))}" target="_blank" rel="noopener noreferrer">Aktualna dostępność ↗</a></div><button class="text-btn" data-remove="${esc(m.id)}">Usuń</button></div>`).join(''):'<div class="empty-state"><span>♡</span><h2>Dobry film na inny wieczór.</h2><p>Po finale możesz zapisać wybrany tytuł na później.</p></div>';
  }else{
    content=journal.length?journal.map(r=>`<article class="session-row"><div class="session-head">${image(r.movie,'library-poster')}<div class="info"><time>${esc(dateText(r.chosenAt))}</time><h3>${esc(r.movie.title)}</h3><span class="state-chip ${r.watchedAt?'watched':''}">${filmStatus(r)}</span></div></div><p class="session-metrics">${esc(L.duration(r.stats.elapsedMs))}${r.stats.measured?'':' od wznowienia'} · ${r.stats.decisions} ${L.plural(r.stats.decisions,'decyzja','decyzje','decyzji')} · ${r.stats.defeated} pokonanych</p><div class="row-actions"><a class="inline-link" href="${esc(safeURL(r.movie.url))}" target="_blank" rel="noopener noreferrer">Sprawdź dostępność ↗</a>${r.watchedAt?'':`<button class="text-btn" data-watched="${esc(r.id)}">✓ Obejrzany</button>`}<button class="text-btn" data-delete-session="${esc(r.id)}" aria-label="Usuń seans ${esc(r.movie.title)}">Usuń</button></div>${r.watchedAt?scoreHTML(r):''}</article>`).join(''):'<div class="empty-state"><span>▶</span><h2>Jeszcze wszystko przed Tobą.</h2><p>Po pierwszym wyborze zobaczysz tu film i prawdziwe statystyki sesji.</p></div>';
  }
  return `<section class="library"><div class="eyebrow">TWÓJ MAŁY KLUB FILMOWY</div><h1>Moje seanse.</h1><div class="library-stats"><div><strong>${a.chosen}</strong><span>wybranych</span></div><div><strong>${a.opened}</strong><span>otwartych na platformie</span></div><div><strong>${a.watched}</strong><span>obejrzanych</span></div><div><strong>${esc(L.duration(a.averageMs))}</strong><span>średni czas wyboru</span></div></div><p class="help-line">Obejrzane oznaczasz sam. Średnia z ${a.measured} kompletnych sesji.<br>Dane zostają w tej przeglądarce; nie synchronizujemy ich z platformami.</p>${tabs}<div role="tabpanel">${content}</div><div class="backup-actions"><button class="text-btn" data-action="export">↓ Kopia danych</button><button class="text-btn" data-action="import">↑ Wczytaj kopię</button></div><button class="primary" data-action="home">Wróć do wybierania</button></section>`;
}
function patchDuel(){
  for(const side of [0,1]){
    const el=$(`.movie[data-side="${side}"]`),id=game.pair[side];
    if(!el||el.dataset.movie!==id){if(el)el.outerHTML=cardHTML(id,side);continue;}
    const champion=game.champion===id;el.classList.toggle('is-champion',champion);
    const holder=document.createElement('div');holder.innerHTML=cardHTML(id,side);
    el.querySelector('.poster-badge').innerHTML=holder.querySelector('.poster-badge').innerHTML;
    el.querySelector('.streak').innerHTML=holder.querySelector('.streak').innerHTML;
    el.querySelector('.streak').className=holder.querySelector('.streak').className;
  }
  $('.duel-top').innerHTML=`<span>TWÓJ FILM NA DZIŚ</span><span><strong>${game.completed}</strong> / ${game.goal} decyzji</span>`;
  $('.progress div').style.width=`${game.completed/game.goal*100}%`;
  $('.duel-title p').textContent=game.champion?'Twój faworyt zostaje. Nowy film musi go pokonać.':'Kliknij plakat lub przycisk. Wybierz intuicyjnie.';
  $('[data-action="undo"]').disabled=!history.length;
  $('[data-action="finish"]').disabled=!game.champion;
  $('.duel-end .help-line').innerHTML=`${Math.max(0,game.deck.length-game.cursor)} nowych przeciwników w tej puli · <button class="text-btn" data-action="home">Zmień ustawienia</button>`;
  wireImages();
}
function wireImages(){document.querySelectorAll('img').forEach(img=>{if(img.dataset.wired)return;img.dataset.wired='yes';img.addEventListener('error',()=>img.remove(),{once:true});});}
async function animate(el,frames,duration=160){
  if(!el||reduceMotion()||typeof el.animate!=='function')return;
  try{await el.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)',fill:'none'}).finished;}catch{}
}
function prefetchPosters(){
  if(!game)return;game.deck.slice(game.cursor,game.cursor+3).forEach(id=>{const m=movie(id);if(m?.poster){const img=new Image();img.referrerPolicy='no-referrer';img.src=safeURL(m.poster);}});
}
async function revealWinner(origin){
  let clone=null,rect=null;
  if(origin&&!reduceMotion()){
    rect=origin.getBoundingClientRect();clone=origin.cloneNode(true);clone.className='flying-poster';clone.setAttribute('aria-hidden','true');
    clone.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;z-index:100;pointer-events:none;border-radius:13px;transform-origin:top left;`;
  }
  tick();clockAnchor=null;screen='winner';recordResult();persist();draw();wireImages();window.scrollTo(0,0);
  const target=$('.winner .poster-wrap');
  if(clone&&target&&rect.width){
    document.body.appendChild(clone);target.style.opacity='0';
    const t=target.getBoundingClientRect();
    try{await animate(clone,[{transform:'translate(0,0) scale(1)'},{transform:`translate(${t.left-rect.left}px,${t.top-rect.top}px) scale(${t.width/rect.width})`}],300);}finally{target.style.opacity='';clone.remove();}
  }
  play('final');announce(game.champion?`Mamy film: ${movie(game.champion).title}`:'Pula filmów została wyczerpana.');
}
function afterMove(){
  tick();screen=game.done?'winner':'duel';tick();if(game.done)recordResult();persist();draw();wireImages();prefetchPosters();
}
function start(){
  const pool=currentPool();if(pool.length<2||moving)return;
  tick();activeMovies=new Map(pool.map(m=>[m.id,m]));gameFetchedAt=catalogue.fetchedAt;
  game=C.createGame(C.shuffle(pool),Number(options.rounds));session=L.create();history=[];
  afterMove();window.scrollTo(0,0);if(pool.length<=options.rounds)notify(`W tej puli będzie ${game.goal} pojedynków.`);
}
async function move(kind,side){
  if(screen!=='duel'||!game||game.done||moving||Date.now()<pending)return;
  moving=true;pending=Date.now()+320;$('#app').setAttribute('aria-busy','true');
  tick();remember();S.unlock();const previous=game.pair.slice(),oldChampion=game.champion;
  try{
    if(kind==='pick'){
      const winner=game.pair[side],loser=game.pair[1-side];
      session.events.push({type:'pick',winner,loser,at:Math.round(session.elapsedMs)});
      game=C.choose(game,side);play('pick');
      if(game.done){clockAnchor=null;await revealWinner($(`.movie[data-side="${side}"] .poster-wrap`));return;}
      const winnerCard=$(`.movie[data-side="${side}"]`);
      animate(winnerCard,[{transform:'scale(1)'},{transform:'scale(1.015)',offset:.45},{transform:'scale(1)'}],200);
      await animate($(`.movie[data-side="${1-side}"]`),[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${side===0?22:-22}px)`}],135);
    }else if(kind==='seen'){
      const id=game.pair[side];session.events.push({type:'seen',movie:id,at:Math.round(session.elapsedMs)});
      if(!seen.includes(id))seen.push(id);write('seen',seen);game=C.replace(game,side);
      await animate($(`.movie[data-side="${side}"]`),[{opacity:1},{opacity:0}],120);
    }else{
      session.events.push({type:'skip',pair:game.pair.slice(),at:Math.round(session.elapsedMs)});game=C.skipBoth(game);
      await animate($('.duel'),[{opacity:1},{opacity:.3}],120);
    }
    if(game.done){clockAnchor=null;await revealWinner(null);return;}
    patchDuel();persist();play('slide');
    const entrances=[];
    for(const i of [0,1])if(previous[i]!==game.pair[i])entrances.push(animate($(`.movie[data-side="${i}"]`),[{opacity:0,transform:`translateX(${i===0?-18:18}px)`},{opacity:1,transform:'translateX(0)'}],155));
    await Promise.all(entrances);prefetchPosters();
    if(kind==='pick')announce(`${oldChampion&&oldChampion!==game.champion?'Nowy faworyt. ':''}${movie(game.champion).title}. ${game.wins} wygranych z rzędu. Decyzja ${game.completed} z ${game.goal}.`);
    if(kind==='seen')notify('Film oznaczony jako obejrzany. Cofnij przywraca poprzedni stan.');
  }finally{moving=false;$('#app').removeAttribute('aria-busy');}
}
function undo(){
  if(!history.length||moving)return;tick();const h=history.pop();
  game=h.game;seen=h.seen;session.events=h.events;journal=journal.filter(r=>r.id!==session.id);if(h.entry)journal=L.upsert(journal,h.entry);
  write('seen',seen);saveJournal();pending=Date.now()+120;afterMove();play('undo');announce('Cofnięto ostatnią decyzję.');
}
async function finish(){
  if(!game?.champion||moving||screen!=='duel')return;
  moving=true;tick();remember();game.done=true;clockAnchor=null;
  try{await revealWinner($(`.movie[data-movie="${game.champion}"] .poster-wrap`));}finally{moving=false;}
}
function markWatched(id){
  const r=journal.find(x=>x.id===id);if(!r)return;
  r.watchedAt=r.watchedAt||new Date().toISOString();
  if(!seen.includes(r.movie.id))seen.push(r.movie.id);
  write('seen',seen);saveJournal();draw();notify('Obejrzany. Możesz teraz dodać własną ocenę.');
}
function downloadBackup(){
  const data={app:'Seans',version:2,exportedAt:new Date().toISOString(),options,seen,saved,journal,audioEnabled};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`seans-kopia-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function validMovie(m){return Boolean(m&&typeof m.id==='string'&&m.id.length<200&&typeof m.title==='string'&&m.title.length<1000&&Array.isArray(m.genres)&&m.genres.every(g=>g&&typeof g.id==='string'&&typeof g.name==='string')&&Array.isArray(m.offers)&&m.offers.every(o=>o&&typeof o.provider==='string'&&typeof o.name==='string'&&Boolean(safeURL(o.url)))&&Boolean(safeURL(m.url)));}
function validBackup(x){return Boolean(x&&x.app==='Seans'&&x.version===2&&x.options&&Array.isArray(x.options.services)&&x.options.services.every(v=>typeof v==='string')&&Array.isArray(x.seen)&&x.seen.length<30000&&x.seen.every(v=>typeof v==='string')&&Array.isArray(x.saved)&&x.saved.length<=1000&&x.saved.every(validMovie)&&Array.isArray(x.journal)&&x.journal.length<=200&&x.journal.every(r=>r&&typeof r.id==='string'&&validMovie(r.movie)&&Number.isFinite(Date.parse(r.chosenAt))&&r.stats&&['elapsedMs','decisions','defeated'].every(k=>Number.isFinite(r.stats[k])&&r.stats[k]>=0)&&typeof r.stats.measured==='boolean'&&Array.isArray(r.events)&&[null,1,2,3,4,5].includes(r.score)));}
async function importBackup(file){
  if(!file)return;
  try{
    if(file.size>5*1024*1024)throw Error('Kopia jest większa niż 5 MB.');
    const x=JSON.parse(await file.text());if(!validBackup(x))throw Error('To nie jest poprawna kopia danych Seansu 0.2.');
    if(!confirm('Zastąpić lokalną historię, oceny i listy danymi z tej kopii?'))return;
    tick();game=null;session=null;history=[];clockAnchor=null;resume=null;
    options={services:x.options.services,rounds:[10,25,50].includes(Number(x.options.rounds))?Number(x.options.rounds):25,genre:String(x.options.genre||''),runtime:String(x.options.runtime||''),rating:String(x.options.rating||''),year:String(x.options.year||'')};
    seen=x.seen;saved=x.saved;journal=x.journal;audioEnabled=x.audioEnabled===true;S.set(audioEnabled);
    write('seen',seen);write('saved',saved);saveOptions();saveJournal();write('sound.v02',audioEnabled);write('session',null,true);
    $('#sheet').close();screen='library';draw();notify('Kopia wczytana.');
  }catch(e){notify(e.message||'Nie udało się wczytać kopii.');}
}
document.addEventListener('change',e=>{const key=e.target.dataset.option;if(key&&['genre','runtime','rating','year'].includes(key)&&!moving){options[key]=e.target.value;saveOptions();draw();}});
document.addEventListener('click',e=>{
  const el=e.target.closest('button,a');if(!el||el.disabled)return;const d=el.dataset;
  if(moving&&!['sound','close'].includes(d.action)){e.preventDefault();return;}
  if(d.action==='sound'){audioEnabled=!audioEnabled;S.set(audioEnabled);write('sound.v02',audioEnabled);audioButton();if(audioEnabled){play('pick');notify(S.supported()?'Dźwięki włączone.':'Ta przeglądarka nie udostępnia dźwięków.');}return;}
  S.unlock();
  if(d.service){options.services=options.services.includes(d.service)?options.services.filter(s=>s!==d.service):[...options.services,d.service];saveOptions();draw();return;}
  if(d.rounds){options.rounds=Number(d.rounds);saveOptions();draw();return;}
  if(d.pick!==undefined){move('pick',Number(d.pick));return;}
  if(d.seen!==undefined){move('seen',Number(d.seen));return;}
  if(d.detail){showDetail(d.detail);return;}
  if(d.remove){saved=saved.filter(m=>m.id!==d.remove);write('saved',saved);draw();return;}
  if(d.tab){libraryTab=d.tab;draw();return;}
  if(d.watched){markWatched(d.watched);return;}
  if(d.dismiss){const r=journal.find(x=>x.id===d.dismiss);if(r){r.followupDismissed=true;saveJournal();draw();}return;}
  if(d.rate){const r=journal.find(x=>x.id===d.rate),n=Number(d.score);if(r?.watchedAt&&[1,2,3,4,5].includes(n)){r.score=n;saveJournal();draw();}return;}
  if(d.deleteSession){if(confirm('Usunąć ten seans z historii?')){journal=journal.filter(x=>x.id!==d.deleteSession);saveJournal();draw();}return;}
  if(d.open){
    if(game?.done&&session?.id===d.open){
      if(!L.summary(session,game).chosen)session.events.push({type:'accept',winner:game.champion,at:Math.round(session.elapsedMs)});
      recordResult();persist();
    }
    const r=journal.find(x=>x.id===d.open);if(r){r.openedAt=r.openedAt||new Date().toISOString();saveJournal();}
    // Do not prevent the user's link click. Only record an opening, never a watch.
    setTimeout(()=>{if(screen==='winner')draw();},0);return;
  }
  switch(d.action){
    case 'home':tick();clockAnchor=null;persist();screen=catalogue?'home':'error';game=null;session=null;history=[];draw();window.scrollTo(0,0);break;
    case 'start':start();break;
    case 'undo':undo();break;
    case 'skip':move('skip');break;
    case 'finish':finish();break;
    case 'accept':if(game?.champion){session.events.push({type:'accept',winner:game.champion,at:Math.round(session.elapsedMs)});recordResult();persist();draw();}break;
    case 'more':if(game){game=C.continueGame(game);afterMove();window.scrollTo(0,0);}break;
    case 'save':{const m=movie(game?.champion);if(m&&!saved.some(s=>s.id===m.id)){saved.unshift(m);write('saved',saved);draw();notify('Zapisano na kolejny wieczór.');}break;}
    case 'library':tick();clockAnchor=null;persist();screen='library';draw();window.scrollTo(0,0);break;
    case 'about':about();break;
    case 'close':$('#sheet').close();break;
    case 'reload':load();break;
    case 'export':downloadBackup();break;
    case 'import':$('#import-file').click();break;
    case 'clear-seen':if(confirm('Przywrócić oznaczone jako obejrzane do losowania? Historia seansów pozostanie.')){seen=[];write('seen',seen);draw();}break;
    case 'clear-data':if(confirm('Usunąć ustawienia, historię, oceny i wszystkie listy z tej przeglądarki?')){
      tick();clockAnchor=null;seen=[];saved=[];journal=[];options={services:[],rounds:25,genre:'',runtime:'',rating:'',year:''};
      for(const name of ['localStorage','sessionStorage'])try{const store=window[name];Object.keys(store).filter(k=>k.startsWith(STORE+'.')).forEach(k=>store.removeItem(k));}catch{}
      audioEnabled=false;S.set(false);resume=null;game=null;session=null;history=[];$('#sheet').close();screen='home';draw();notify('Lokalne dane usunięte.');
    }break;
    case 'resume':if(resume?.pool?.length>=2&&resume.game){
      activeMovies=new Map(resume.pool.map(m=>[m.id,m]));game=resume.game;options=resume.options;
      session=resume.session||L.create(game.completed,false);history=resume.session&&Array.isArray(resume.history)?resume.history:[];gameFetchedAt=resume.fetchedAt;
      clockAnchor=null;afterMove();notify('Wznowiono wybór. Czas poza aplikacją nie jest doliczany.');
    }break;
  }
});
$('#import-file').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';importBackup(f);});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#sheet').close();}});
document.addEventListener('visibilitychange',()=>{tick();persist();});
window.addEventListener('pagehide',()=>{tick();clockAnchor=null;persist();});
setInterval(()=>{tick();if(game&&Date.now()-lastPersistence>4000){persist();lastPersistence=Date.now();}},1000);
load();
