from pathlib import Path
import hashlib,json,os,sys
root=Path(__file__).resolve().parents[1]
p=json.loads((root/'project.json').read_text())
assert p['repository']=='KADARstudio/seans' and p['repositoryId']==1376451444
assert os.environ.get('GITHUB_REPOSITORY','KADARstudio/seans')=='KADARstudio/seans'
app=root/'docs/app.js';s=app.read_text()
if 'const MOTION={exit:380,enter:440,select:620,final:850};' in s:
 print('0.3 source already prepared');sys.exit(0)
raw=app.read_bytes()
assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()=='125572d2b0f2d319d2d803031ad7a382aa96bc37','Unexpected base; do not overwrite newer work'
def function(name,new):
 global s
 start=s.index('function '+name+'(');end=s.find('\nfunction ',start+1);ae=s.find('\nasync function ',start+1)
 if ae!=-1 and (end==-1 or ae<end):end=ae
 if end==-1:raise ValueError(name)
 s=s[:start]+new.strip()+s[end:]
s=s.replace('const reduceMotion=',"options.watchState=['all','new','seen'].includes(options.watchState)?options.watchState:'all';\nconst MOTION={exit:380,enter:440,select:620,final:850};\nconst reduceMotion=",1)
s=s.replace("function play(kind){if(audioEnabled)S.play(kind);}","function play(kind){return audioEnabled?S.play(kind):Promise.resolve(false);}")
s=s.replace('function draw(){const views=','function draw(){document.body.dataset.screen=screen;const views=',1)
s=s.replace('ageHours()>3','ageHours()>Math.max(3,(catalogue?.refreshHours||1)*1.5)')
s=s.replace('<br>${catalogue.movies.length} filmów w puli · datowana kopia katalogu.',"<br>${catalogue.movies.length.toLocaleString('pl-PL')} filmów · ${catalogue.coverage?.complete?'pobrano wszystkie strony źródła':'katalog częściowy'}.")
s=s.replace('},12000)','},30000)')
s=s.replace("write('catalogue',c)","window.SeansCache?.put(c)")
s=s.replace("if(!data){const c=read('catalogue',null);if(validCatalogue(c)){data=c;offlineCopy=true;}}","if(!data){const c=(await window.SeansCache?.get())||read('catalogue',null);if(validCatalogue(c)){data=c;offlineCopy=true;}}")
function('homeHTML',r'''function homeHTML(){
 const pool=currentPool(),filters=[options.genre?genreNames[options.genre]||options.genre:null,options.runtime?`do ${options.runtime} min`:null,options.rating?`IMDb ${options.rating}+`:null,options.year?`od ${options.year}`:null,options.watchState==='new'?'Tylko nowe':options.watchState==='seen'?'Na powtórkę':null].filter(Boolean);
 return `<section class="home-screen"><div class="home-intro"><div class="eyebrow">WIECZÓR BEZ PRZEWIJANIA</div><h1>Co dziś <span>oglądamy?</span></h1><p>Dwa plakaty. Zwycięzca zostaje.</p></div><div class="platform-section"><div class="section-label">Twoje platformy <small>Polskie abonamenty</small></div><div class="service-grid">${catalogue.providers.map(p=>{const n=catalogue.movies.filter(m=>m.offers.some(o=>o.provider===p.id)).length;return`<button class="service" data-service="${esc(p.id)}" aria-pressed="${options.services.includes(p.id)}" aria-label="${esc(p.name)}"><span class="check">✓</span><strong>${esc(pretty[p.id]||p.name)}</strong><small>${n.toLocaleString('pl-PL')} filmów</small></button>`;}).join('')}</div></div><button class="filter-launch secondary" data-action="filters"><span>☷ <strong>Filtry i powtórki</strong><small>${esc(filters.join(' · ')||'Każdy gatunek · również obejrzane')}</small></span><span aria-hidden="true">›</span></button><div class="round-section"><div class="section-label">Ile pojedynków? <small>Możesz skończyć wcześniej</small></div><div class="segments">${[10,25,50].map(n=>`<button class="segment" data-rounds="${n}" aria-pressed="${Number(options.rounds)===n}">${n}</button>`).join('')}</div></div>${resume?.game&&!resume.game.done&&!game?'<button class="secondary resume" data-action="resume">↶ Wznów poprzedni wybór</button>':''}<div class="home-start"><button class="primary" data-action="start" ${pool.length<2?'disabled':''}>${!options.services.length?'Zaznacz swoje platformy':pool.length<2?'Zmień filtry — za mało filmów':'Znajdźmy film'} <span>↗</span></button><p class="help-line">${options.services.length?`${pool.length.toLocaleString('pl-PL')} pasujących filmów · `:''}Obejrzane mogą wygrać ponownie.</p></div><button class="catalog-status text-btn" data-action="catalog-info"><span class="dot"></span><span>${catalogue.movies.length.toLocaleString('pl-PL')} filmów · dane ${dateText(catalogue.fetchedAt)}${isStale()?' · starsza kopia':''} ⓘ</span></button></section>`;
}
function showFilters(){
 const genres=new Map();catalogue.movies.forEach(m=>m.genres.forEach(g=>genres.set(g.id,genreName(g))));
 const select=(id,label,items)=>`<label class="field"><span>${label}</span><select data-option="${id}" aria-label="${label}">${items.map(([value,name])=>`<option value="${esc(value)}" ${String(options[id])===String(value)?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
 $('#sheet-content').innerHTML=`<div class="eyebrow">DZISIEJSZY SEANS</div><h2>Na co masz ochotę?</h2><div class="filter-grid">${select('watchState','Znasz już ten film?',[['all','Wszystkie, również obejrzane'],['new','Tylko nieobejrzane'],['seen','Tylko filmy na powtórkę']])}${select('genre','Gatunek',[['','Każdy gatunek'],...[...genres.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pl'))])}${select('runtime','Długość',[['','Bez limitu'],[100,'Do 100 minut'],[120,'Do 2 godzin'],[150,'Do 2,5 godziny']])}${select('rating','Ocena IMDb',[['','Każda ocena'],[6,'Co najmniej 6,0'],[7,'Co najmniej 7,0'],[8,'Co najmniej 8,0']])}${select('year','Rok premiery',[['','Wszystkie lata'],[2000,'Od 2000'],[2010,'Od 2010'],[2020,'Od 2020']])}</div><p>„Widziałem” tylko oznacza znajomy film. Nie odrzuca go i nie kończy pojedynku.</p><button class="primary" data-action="close">Gotowe — wróć do wyboru</button><button class="secondary sound-test" data-action="sound-test">♫ Odtwórz test dźwięku</button><p class="small">Dźwięki korzystają z głośności multimediów. Jeżeli nic nie słychać, sprawdź głośność i podłączone słuchawki.</p>`;
 $('#sheet').showModal();
}
function catalogueInfo(){
 const cov=catalogue.coverage;
 $('#sheet-content').innerHTML=`<div class="eyebrow">KATALOG • POLSKA</div><h2>${catalogue.movies.length.toLocaleString('pl-PL')} filmów</h2>${statusHTML()}<p>${cov?.complete?'Pobrano wszystkie strony wyników udostępnionych przez źródło dla sześciu platform.':'To częściowa kopia katalogu. Nie oznacza pełnej oferty platform.'} Dostępność według JustWatch; opóźnienia i braki źródła są możliwe. Bez wypożyczeń i dodatkowo płatnych kanałów.</p>${cov?.providers?`<div class="coverage-list">${cov.providers.map(p=>`<p><strong>${esc(p.name)}</strong><span>${p.acceptedCount} filmów · ${p.pages} stron${p.complete?'':' · niepełne'}</span></p>`).join('')}</div>`:''}<p class="small">Nowe pobranie zaplanowane co ${catalogue.refreshHours||1} godz. Data to faktyczne pobranie, nie gwarancja dostępności podczas odtwarzania.</p><a class="inline-link" href="https://www.justwatch.com/pl" target="_blank" rel="noopener noreferrer">Źródło: JustWatch ↗</a><button class="primary" data-action="close">Wróć do Seansu</button>`;
 $('#sheet').showModal();
}''')
function('cardHTML',r'''function cardHTML(id,side){
 const m=movie(id);if(!m)return'';const champion=game.champion===id,known=seen.includes(id);
 const badges=`<div class="poster-badge">${champion?'<span class="badge champ">✦ FAWORYT</span>':'<span></span>'}${m.rating?`<span class="badge rating">★ ${Number(m.rating).toFixed(1)}</span>`:''}</div>`;
 return`<article class="movie ${champion?'is-champion':''}" data-movie="${esc(id)}" data-side="${side}"><button class="poster-button" data-pick="${side}" aria-label="Wybieram: ${esc(m.title)}">${poster(m,badges)}</button><div class="streak ${champion?'active':''}">${champion?`✦ ${game.wins} ${L.plural(game.wins,'wygrana','wygrane','wygranych')}`:'Nowy pretendent'}</div><h2>${esc(m.title)}</h2><div class="movie-meta">${esc([m.year,m.runtime?m.runtime+' min':null].filter(Boolean).join(' · '))}</div><div class="provider-tags">${selectedOffers(m).slice(0,2).map(o=>`<span class="provider-tag">${esc(pretty[o.provider]||o.name)}</span>`).join('')}</div><button class="primary pick" data-pick="${side}">Wybieram <span>↗</span></button><div class="movie-tools"><button class="text-btn seen-toggle" data-seen="${side}" aria-pressed="${known}" aria-label="${known?'Cofnij oznaczenie obejrzanego':'Oznacz jako obejrzany'}: ${esc(m.title)}">${known?'✓ Widziałem':'Widziałem'}</button><button class="text-btn detail-toggle" data-detail="${esc(id)}" aria-label="Opis filmu: ${esc(m.title)}">Opis</button></div></article>`;
}''')
function('duelHTML',r'''function duelHTML(){return`<div class="duel-top"><span>TWÓJ FILM NA DZIŚ</span><span><strong>${game.completed}</strong> / ${game.goal}</span></div><div class="progress"><div style="width:${Math.round(game.completed/game.goal*100)}%"></div></div><div class="duel-title"><h1>Na który masz ochotę?</h1><p>${game.champion?'Faworyt zostaje. Wybierz kolejny raz.':'Kliknij plakat lub „Wybieram”.'}</p></div><div class="duel">${cardHTML(game.pair[0],0)}<span class="versus">VS</span>${cardHTML(game.pair[1],1)}</div><div class="duel-actions"><button class="secondary" data-action="undo" ${history.length?'':'disabled'}>↶ Cofnij</button><button class="secondary" data-action="skip">Żaden</button><button class="primary finish" data-action="finish" ${game.champion?'':'disabled'}>Mam film ✓</button></div><div class="duel-end"><span>„Widziałem” nie odrzuca filmu.</span><button class="text-btn" data-action="catalog-info">${isStale()?'⚠ Starsze dane':'Oferty PL'} ⓘ</button></div>`;}''')
function('winnerHTML',r'''function winnerHTML(){
 const m=movie(game?.champion);if(!m)return`<div class="error-box"><h2>Przejrzeliśmy tę pulę.</h2><p>Zmień filtry lub platformy.</p><button class="primary" data-action="home">Nowy wybór</button></div>`;
 const offers=selectedOffers(m),chosen=L.summary(session,game).chosen;
 return`<section class="winner"><div class="winner-heading"><div class="eyebrow">KONIEC SZUKANIA</div><h1>${chosen?'Mamy film.':'Ostatni kandydat.'}</h1></div><div class="winner-hero">${poster(m)}<div class="winner-info"><h2>${esc(m.title)}</h2><div class="movie-meta">${esc(meta(m))}</div><div class="provider-tags">${tags(m)}</div><button class="secondary" data-action="winner-details">Opis i ocena ⓘ</button></div></div>${resultStatsHTML()}${!chosen?'<button class="primary" data-action="accept">Wybieram ten film ✓</button>':''}<div class="watch-links">${offers.slice(0,1).map(o=>`<a class="primary" data-open="${esc(session.id)}" href="${esc(safeURL(o.url))}" target="_blank" rel="noopener noreferrer">▶ Otwórz ${esc(o.name)} ↗</a>`).join('')}${offers.length>1?'<button class="text-btn" data-action="all-offers">Inne platformy ↗</button>':''}</div><div class="winner-actions"><button class="secondary" data-action="save">${saved.some(s=>s.id===m.id)?'♥ Zapisany':'♡ Na później'}</button><button class="secondary" data-action="more" ${game.pair.every(Boolean)?'':'disabled'}>Jeszcze 10 par</button></div><div class="winner-bottom"><button class="text-btn" data-action="undo" ${history.length?'':'disabled'}>↶ Cofnij</button><button class="text-btn" data-action="home">Nowy wybór</button><button class="text-btn" data-action="catalog-info">Oferty ⓘ</button></div><p class="winner-date">Dane ${dateText(currentDate())}${isStale()?' · ⚠ starsza kopia':''}. Dostępność może się zmienić.</p></section>`;
}
function winnerDetails(){
 const m=movie(game?.champion);if(!m)return;
 $('#sheet-content').innerHTML=`<h2>${esc(m.title)}</h2><p>${esc(meta(m))}</p><p class="description">${esc(m.description||'Brak opisu w źródle.')}</p>${chosenActionsHTML()}<a class="inline-link" href="${esc(safeURL(m.url))}" target="_blank" rel="noopener noreferrer">Sprawdź w JustWatch ↗</a><button class="primary" data-action="close">Wróć do filmu</button>`;$('#sheet').showModal();
}
function allOffers(){
 const m=movie(game?.champion);if(!m)return;
 $('#sheet-content').innerHTML=`<h2>Gdzie obejrzeć?</h2><p>${esc(m.title)}</p><div class="watch-links">${selectedOffers(m).map(o=>`<a class="primary" data-open="${esc(session.id)}" href="${esc(safeURL(o.url))}" target="_blank" rel="noopener noreferrer">▶ ${esc(o.name)} ↗</a>`).join('')}</div><p>Oferty PL z ${dateText(currentDate())}. Dostępność może się zmienić.</p>`;$('#sheet').showModal();
}''')
s=s.replace("el.querySelector('.streak').className=holder.querySelector('.streak').className;","el.querySelector('.streak').className=holder.querySelector('.streak').className;\n    el.querySelector('.movie-tools').innerHTML=holder.querySelector('.movie-tools').innerHTML;")
s=s.replace('${game.goal} decyzji','${game.goal}')
s=s.replace("$('.duel-end .help-line').innerHTML=","/* Duel footer stays compact. */\n  /* $('.duel-end .help-line').innerHTML=")
s=s.replace('Zmień ustawienia</button>`;\n  wireImages();','Zmień ustawienia</button>`; */\n  wireImages();')
s=s.replace('function animate(el,frames,duration=160)','function animate(el,frames,duration=440)')
s=s.replace('],300);','],MOTION.final);')
s=s.replace("  play('final');announce","  announce")
s=s.replace('game=C.createGame(C.shuffle(pool),Number(options.rounds));',"// Each session draws a fair sample from the ENTIRE matching catalogue.\n  // Limit the persisted session (not the catalogue) to keep browser storage small.\n  const deck=C.shuffle(pool).slice(0,Math.max(150,Number(options.rounds)*6+1));\n  activeMovies=new Map(deck.map(m=>[m.id,m]));\n  game=C.createGame(deck,Number(options.rounds));")
s=s.replace("game=C.choose(game,side);play('pick');","game=C.choose(game,side);play(game.done?'final':'pick');")
s=s.replace('],200);','],MOTION.select);').replace('}],135)','}],MOTION.exit)')
s=s.replace('translateX(${side===0?22:-22}px)','translateX(${side===0?60:-60}px)')
s=s.replace('      if(!seen.includes(id))seen.push(id);write(\'seen\',seen);game=C.replace(game,side);\n      await animate($(`.movie[data-side="${side}"]`),[{opacity:1},{opacity:0}],120);',"      if(seen.includes(id))seen=seen.filter(x=>x!==id);else seen.push(id);\n      write('seen',seen);patchDuel();persist();\n      announce(seen.includes(id)?'Oznaczono jako obejrzany. Film zostaje w pojedynku.':'Cofnięto oznaczenie obejrzanego.');\n      return;")
s=s.replace('}],120);\n    }','}],MOTION.exit);\n    }')
s=s.replace('}],155)','}],MOTION.enter)')
s=s.replace('  try{await revealWinner',"  play('final');try{await revealWinner")
s=s.replace("'genre','runtime','rating','year'].includes(key)","'genre','runtime','rating','year','watchState'].includes(key)")
s=s.replace("year:String(x.options.year||'')","year:String(x.options.year||''),watchState:['all','new','seen'].includes(x.options.watchState)?x.options.watchState:'all'")
s=s.replace('Przywrócić oznaczone jako obejrzane do losowania? Historia seansów pozostanie.','Usunąć oznaczenia obejrzanych? Historia seansów pozostanie.')
s=s.replace("notify(S.supported()?'Dźwięki włączone.':'Ta przeglądarka nie udostępnia dźwięków.');","notify(S.supported()?'Test dźwięku — sprawdź głośność multimediów.':'Ta przeglądarka nie udostępnia dźwięków.');")
s=s.replace("    case 'start':","    case 'filters':showFilters();break;\n    case 'catalog-info':catalogueInfo();break;\n    case 'winner-details':winnerDetails();break;\n    case 'all-offers':allOffers();break;\n    case 'sound-test':audioEnabled=true;S.set(true);write('sound.v02',true);audioButton();play('test');break;\n    case 'start':")
s=s.replace("draw();notify('Obejrzany. Możesz teraz dodać własną ocenę.');","draw();if($('#sheet').open)winnerDetails();notify('Obejrzany. Film nadal może wrócić na kolejny seans.');")
s=s.replace('r.score=n;saveJournal();draw();',"r.score=n;saveJournal();draw();if($('#sheet').open)winnerDetails();")
s=s.replace('WERSJA 0.2.1','WERSJA 0.3.0')
s=s.replace('Pobieramy próbkę do 100 popularnych filmów na platformę i sprawdzamy polskie oferty w abonamencie. Nie pobieramy całych katalogów.','Pobieramy kolejne strony katalogów sześciu platform do końca wyników źródła. Kompletność i liczby znajdziesz w informacji o katalogu. To nie jest gwarancja, że źródło obejmuje każdą pozycję platformy.')
s=s.replace('Pobieranie nowych ofert zaplanowano co godzinę','Pobieranie nowych ofert zaplanowano co sześć godzin')
s=s.replace('setInterval(()=>{tick();',"if(S.onError)S.onError(message=>{notify(message);audioButton();});\nsetInterval(()=>{tick();")
s=s.replace("const id=game.pair[side];session.events.push({type:'seen',movie:id","const id=game.pair[side];session.events.push({type:seen.includes(id)?'unseen':'seen',movie:id")
app.write_text(s)
p=root/'docs/core.js';p.write_text(p.read_text().replace('!seen.includes(m.id)&&',"(options.watchState==='new'?!seen.includes(m.id):options.watchState==='seen'?seen.includes(m.id):true)&&"))
p=root/'docs/index.html';h=p.read_text().replace('0.2.1 BETA','0.3.0 BETA').replace('?v=02','?v=030').replace('src="core.js"','src="core.js?v=030"')
h=h.replace('</head>','<link rel="stylesheet" href="mobile-v03.css?v=030">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon.png">\n</head>')
h=h.replace('<script src="app.js','<script src="catalog-cache.js?v=030"></script><script src="app.js')
p.write_text(h)
print('Prepared reviewed mobile source on the exact known base.')
