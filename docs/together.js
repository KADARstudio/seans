/* A new page, not a replacement for solo mode. No third-party analytics or sounds. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PREFIX = 'seans.duo.v04.', OLD = 'seans.prototype.v1.', UUID = /^[0-9a-f-]{36}$/i, SECRET = /^[0-9a-f]{64}$/;
  const names = { netflix: 'Netflix', prime: 'Prime Video', disney: 'Disney+', max: 'HBO Max', apple: 'Apple TV', sky: 'SkyShowtime' };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { throw Object.assign(Error(), { code: 'STORAGE_UNAVAILABLE' }); } }
  const safe = x => { try { const u = new URL(x); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const errors = { BACKEND_NOT_CONFIGURED: 'Tryb dwóch telefonów czeka na podłączenie osobnej usługi pokoi Seansu. Niczego nie musisz wpisywać ani kupować.', UNSAFE_HOST: 'Wspólne pokoje wymagają własnego adresu Seansu. Nie zapisujemy sesji na współdzielonym hostingu podglądów.', ROOM_UNAVAILABLE: 'Ten pokój wygasł, został zamknięty albo nie jest dostępny dla tego urządzenia.', INVITE_UNAVAILABLE: 'Zaproszenie jest nieprawidłowe albo pokój ma już dwie osoby.', ROOM_LIMIT: 'Osiągnięto limit pokojów testowych. Spróbuj później.', SESSION_EXPIRED: 'Sesja tego urządzenia wygasła. Utwórzcie nowy pokój.', STALE_STATE: 'Stan pokoju się zmienił. Odświeżam go — sprawdź parę przed ponownym wyborem.', ROUND_FINISHED: 'Ta runda jest już zakończona. Pobieram aktualny etap.', STORAGE_UNAVAILABLE: 'Przeglądarka nie pozwala zapisać sesji. Włącz jej lokalną pamięć, aby nie utracić pokoju.', INVALID_POOL: 'Za mało różnych filmów dla wybranych platform.', SERVICE_UNAVAILABLE: 'Usługa pokoi chwilowo nie odpowiada.', REQUEST_PENDING: 'Poprzedni wybór czeka jeszcze na potwierdzenie.' };
  let catalogue, films = new Map(), client = null, configError = null, room = null, busy = false, timer = null, stopped = false;
  let connection = read(PREFIX + 'connection', null), pending = read(PREFIX + 'pending', null);
  let choices = read(OLD + 'options', {}).services || [], seen = read(OLD + 'seen', []);
  if (!Array.isArray(choices)) choices = []; if (!Array.isArray(seen)) seen = [];
  let clock = read(PREFIX + 'clock', { roomId: null, elapsed: 0 }), anchor = null;
  let invite = null;
  try { const value = new URLSearchParams(location.hash.slice(1)).get('invite');
    if (value) { const [id, secret] = value.split('.'); if (!UUID.test(id) || !SECRET.test(secret)) throw Error(); invite = { id, secret }; sessionStorage.setItem(PREFIX + 'invite', JSON.stringify(invite)); }
    else invite = JSON.parse(sessionStorage.getItem(PREFIX + 'invite'));
  } catch { alertText('Zaproszenie jest nieprawidłowe. Poproś o nowy link.'); }
  // Keep the invitation secret out of the address bar and all outgoing referrers.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  function alertText(text, retry = false) { const el = $('#duo-alert'); el.hidden = !text; el.innerHTML = esc(text || '') + (retry ? ' <button data-duo="retry">Ponów połączenie</button>' : ''); }
  function showError(e) { alertText(errors[e.code] || 'Brak połączenia. Nie kasuję ostatniego wyboru. Spróbuj ponownie.', !['BACKEND_NOT_CONFIGURED','UNSAFE_HOST','ROOM_UNAVAILABLE','INVITE_UNAVAILABLE'].includes(e.code)); }
  function tick(next) { const now = performance.now(); if (anchor !== null) clock.elapsed += Math.max(0, now - anchor);
    anchor = (next || room)?.phase === 'picking' && !(next || room)?.self?.done && !document.hidden ? now : null;
    try { save(PREFIX + 'clock', clock); } catch {} }
  function movie(id) { return films.get(id) || { id, title: 'Film niedostępny w tej kopii katalogu', year: null, offers: [], genres: [] }; }
  function image(m, cls = '') { const url = safe(m.poster); return url ? `<img class="${cls}" src="${esc(url)}" alt="Plakat: ${esc(m.title)}" referrerpolicy="no-referrer" decoding="async">` : ''; }
  function meta(m) { return [m.year > 0 ? m.year : null, m.runtime ? m.runtime + ' min' : null, m.rating ? '★ ' + m.rating : null].filter(Boolean).join(' · '); }
  function enabled() { return client && !configError; }
  function blocked() { return busy || pending; }
  function startClock(id) { if (clock.roomId !== id) clock = { roomId: id, elapsed: 0 }; }
  function recordMatch() {
    if (room?.phase !== 'matched' || !films.has(room.winner)) return;
    const id = 'duo-' + room.id, rows = read(OLD + 'journal.v02', []), old = rows.find(r => r.id === id);
    if (old) return;
    save(OLD + 'journal.v02', [{ id, chosenAt: new Date(room.matchedAt).toISOString(), startedAt: new Date(room.createdAt).toISOString(), movie: movie(room.winner), services: room.services, fetchedAt: room.catalogueAt, mode: 'together',
      stats: { measured: false, elapsedMs: Math.round(clock.elapsed), decisions: room.self.decisions, defeated: room.self.defeated, chosen: true },
      events: [], openedAt: null, watchedAt: null, score: null }, ...rows].slice(0, 200));
  }
  function adopt(next) {
    if (room && next.id === room.id && next.revision < room.revision) return;
    startClock(next.id); tick(next); room = next;
    try { recordMatch(); } catch (e) { showError(e); }
    render();
  }
  function privacy() { return 'Bez e-maila i hasła. Powstaje anonimowa sesja urządzenia. Głosy tej rundy trafiają do osobnego serwera Seansu. Pokój wygasa po 4 godzinach. Wcześniejsza historia i lista obejrzanych zostają na telefonie.'; }
  function setup() {
    if (invite) return `<section class="duo-center"><div class="eyebrow">ZAPROSZENIE DO SEANSU</div><h1>Dwa gusta.<br>Jeden dobry wieczór.</h1><p>Dołączysz do jednej osoby. Wybieracie niezależnie; finał wymaga potwierdzenia obojga.</p><p>${privacy()}</p><button class="primary" data-duo="join" ${!enabled() || blocked() ? 'disabled' : ''}>Dołączam do wspólnego wyboru</button>${configError ? '<p>' + esc(errors[configError.code]) + '</p>' : ''}</section>`;
    const count = catalogue.movies.filter(m => m.offers.some(o => choices.includes(o.provider))).length;
    return `<section class="duo-setup"><div class="eyebrow">WIECZÓR WE DWOJE</div><h1>Wybierzmy razem.</h1><p>Wskaż platformy dostępne tam, gdzie będziecie oglądać. Oboje dostaniecie wspólną pulę, ale w innej kolejności.</p><div class="service-grid">${catalogue.providers.map(p => `<button class="service" data-duo="service" data-service="${esc(p.id)}" aria-pressed="${choices.includes(p.id)}"><strong>${esc(names[p.id] || p.name)}</strong></button>`).join('')}</div><p class="duo-subtitle">Do 12 pojedynków na osobę. Obejrzane filmy też mogą wygrać.</p><p class="privacy-note">${privacy()} Link zaproszenia przekaż tylko drugiej osobie.</p>${configError ? '<p>' + esc(errors[configError.code]) + '</p>' : ''}<button class="primary" data-duo="create" ${!enabled() || count < 2 || blocked() ? 'disabled' : ''}>Utwórz pokój i zaproś drugą osobę</button><p class="duo-subtitle">${count.toLocaleString('pl-PL')} pasujących filmów · oferty sprawdzone ${new Date(catalogue.fetchedAt).toLocaleDateString('pl-PL')}. Dostępność może się zmienić.</p></section>`;
  }
  function link() { return connection?.secret ? `${location.origin}${location.pathname}#invite=${connection.id}.${connection.secret}` : ''; }
  function waiting() { return `<section class="duo-center"><div class="eyebrow">POKÓJ GOTOWY</div><h1>Zaproś drugą osobę.</h1><p>Otwórzcie link na dwóch różnych telefonach. Każde wybiera po swojemu — swoich odpowiedzi nie pokazujemy sobie przed finałem.</p><button class="primary" data-duo="share">Wyślij zaproszenie</button><button class="secondary" data-duo="copy">Kopiuj link</button><div class="duo-link">${esc(link())}</div><p><span class="duo-live-dot"></span>Czekam, aż druga osoba dołączy.</p><p>Ważne do ${new Date(room.expiresAt).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}. Ten link zajmuje tylko jedno dodatkowe miejsce.</p></section>`; }
  function card(id, side) { const m = movie(id), marked = seen.includes(id), favorite = room.self.champion === id;
    return `<article class="duo-card" data-film="${esc(id)}" data-side="${side}"><button class="duo-poster" data-duo="pick" data-film="${esc(id)}" aria-label="Wybieram ${esc(m.title)}"><span>${esc(m.title)}</span>${image(m)}</button><div class="duo-streak">${favorite ? '✦ ' + room.self.streak + ' wygranych z rzędu' : 'Nowy przeciwnik'}</div><h2>${esc(m.title)}</h2><div class="duo-meta">${esc(meta(m))}</div><button class="primary" data-duo="pick" data-film="${esc(id)}">Wybieram</button><div class="duo-tools"><button class="secondary" data-duo="seen" data-film="${esc(id)}" aria-pressed="${marked}">${marked ? '✓ Widziałem' : 'Widziałem'}</button><button class="secondary" data-duo="details" data-film="${esc(id)}" aria-label="Opis filmu">ⓘ</button></div><button class="duo-veto" data-duo="veto" data-film="${esc(id)}">Tego dziś nie chcę</button></article>`; }
  function progress() { return `<span>RUNDA ${room.round} · <strong>${room.self?.decisions || 0}/${room.self?.goal || 12}</strong></span><span>${room.other.done ? 'Druga osoba jest gotowa ✓' : 'Druga osoba: ' + room.other.decisions + ' decyzji'}</span>`; }
  function picking() {
    if (room.self.done) return `<section class="duo-center"><div class="eyebrow">TWÓJ WYBÓR ZAPISANY</div><h1>Teraz druga osoba.</h1><p>Gdy skończy, zobaczycie propozycje do wspólnego potwierdzenia. Jej pojedynczych głosów nie podglądasz.</p><p>${room.other.decisions} decyzji drugiej osoby</p>${room.self.champion ? `<p>Twój faworyt: <strong>${esc(movie(room.self.champion).title)}</strong></p>` : ''}<button class="secondary" data-duo="undo" ${room.self.canUndo ? '' : 'disabled'}>Cofnij mój ostatni wybór</button></section>`;
    return `<section class="duo-picking"><div class="duo-state">${progress()}</div><h1>Na który masz ochotę?</h1><p class="duo-subtitle">Wygrana w parze to jeszcze nie zgoda na seans.</p><div class="duo-cards">${room.self.pair.map(card).join('')}</div><div class="duo-bottom"><button class="secondary" data-duo="undo" ${room.self.canUndo ? '' : 'disabled'}>↶ Cofnij</button><button class="secondary" data-duo="skip">Dziś żaden</button></div></section>`;
  }
  function confirming() { return `<section class="duo-choices"><div class="eyebrow">TERAZ POTWIERDZENIE OBOJGA</div><h1>Który naprawdę obejrzymy?</h1><p class="duo-subtitle">To propozycje po Waszych wyborach, nie obietnica zgodności. Zaznacz „Tak” przy każdym filmie, który akceptujesz.</p>${room.candidates.map(id => { const m = movie(id), answer = room.self.answers[id]; return `<article class="duo-choice" data-candidate="${esc(id)}">${image(m)}<h2>${esc(m.title)}</h2><div class="duo-choice-buttons"><button class="primary" data-duo="answer" data-film="${esc(id)}" data-accept="true" aria-pressed="${answer === true}">${answer === true ? '✓ Tak' : 'Tak, obejrzę'}</button><button class="secondary" data-duo="answer" data-film="${esc(id)}" data-accept="false" aria-pressed="${answer === false}">Nie dziś</button></div></article>`; }).join('')}<p class="duo-subtitle">Finał pojawi się dopiero po dwóch „Tak” dla tego samego filmu.</p></section>`; }
  function final() { const m = movie(room.winner), offers = m.offers.filter(o => room.services.includes(o.provider));
    return `<section class="duo-center"><div class="eyebrow">OBOJE POWIEDZIELIŚCIE TAK</div><h1>Mamy film.</h1>${image(m,'duo-final-poster')}<h2>${esc(m.title)}</h2><p>${esc(meta(m))}</p><div class="duo-watch">${offers.slice(0,2).map(o => `<a class="primary" data-open-platform href="${esc(safe(o.url))}" target="_blank" rel="noopener noreferrer">Otwórz ${esc(o.name)} ↗</a>`).join('')}</div><p class="duo-subtitle">Otwarcie platformy nie oznacza obejrzenia. Aktualne warunki sprawdź u dostawcy.</p><button class="secondary" data-duo="details" data-film="${esc(m.id)}">Opis i wszystkie dostępne oferty</button></section>`;
  }
  function noMatch() { return `<section class="duo-center"><div class="eyebrow">BEZ WYMUSZONEGO KOMPROMISU</div><h1>Jeszcze nie ten film.</h1><p>Nie ma tytułu, który oboje potwierdziliście. Możemy spróbować świeżej puli bez powtarzania poprzedniej.</p><button class="primary" data-duo="again" ${room.self.next ? 'disabled' : ''}>${room.self.next ? 'Czekam na zgodę drugiej osoby…' : 'Chcę kolejną krótką rundę'}</button>${room.other.next ? '<p>Druga osoba chce następnej rundy.</p>' : ''}</section>`; }
  function render() {
    $('#duo-close').hidden = !room;
    if (room?.phase === 'picking' && !room.self.done && $('.duo-picking')) {
      $('.duo-state').innerHTML = progress();
      const old = [...document.querySelectorAll('.duo-card')];
      room.self.pair.forEach((id,i) => {
        if (old[i]?.dataset.film === id) {
          old[i].querySelector('.duo-streak').textContent = room.self.champion === id ? `✦ ${room.self.streak} wygranych z rzędu` : 'Nowy przeciwnik';
          const b = old[i].querySelector('[data-duo="seen"]'); b.textContent = seen.includes(id) ? '✓ Widziałem' : 'Widziałem'; b.setAttribute('aria-pressed', String(seen.includes(id)));
        } else if (old[i]) { const holder = document.createElement('template'); holder.innerHTML = card(id,i); old[i].replaceWith(holder.content.firstElementChild); }
      });
      $('[data-duo="undo"]').disabled = !room.self.canUndo;
    } else $('#duo-main').innerHTML = !room ? setup() : ({ waiting, picking, confirming, matched: final, 'no-match': noMatch,
      exhausted: () => '<section class="duo-center"><h1>Ta pula się skończyła.</h1><p>Zamknijcie pokój i utwórzcie nowy z innymi platformami.</p></section>' }[room.phase] || noMatch)();
    document.querySelectorAll('[data-duo="pick"],[data-duo="veto"],[data-duo="skip"],[data-duo="answer"]').forEach(b => b.disabled = !!blocked());
    document.querySelectorAll('img').forEach(img => { img.onerror = () => img.style.visibility = 'hidden'; });
  }
  async function animation(el, frames, duration) {
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !el.animate) return;
    try { await el.animate(frames, { duration, easing:'cubic-bezier(.2,.8,.2,1)' }).finished; } catch {}
  }
  async function dispatch(body, animateFilm = null) {
    if (busy) return; busy = true; tick();
    // Save the exact operation before sending. A retry reuses its identity and sequence.
    try { pending = body; save(PREFIX + 'pending', pending); render();
      const result = await client.call(body);
      pending = null; localStorage.removeItem(PREFIX + 'pending');
      if (result.closed) { endRoom(); return; }
      const oldCards = [...document.querySelectorAll('.duo-card')];
      if (animateFilm && room?.phase === 'picking' && result.room.phase === 'picking') {
        const loser = oldCards.find(c => c.dataset.film !== animateFilm);
        await animation(loser, [{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateY(18px) scale(.97)'}],380);
      }
      adopt(result.room); alertText('');
      if (animateFilm && room.phase === 'picking') await animation([...document.querySelectorAll('.duo-card')].find(c => c.dataset.film !== animateFilm),[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],440);
    } catch(e) {
      if (['STALE_STATE','ROUND_FINISHED','INVALID_PHASE','ROOM_UNAVAILABLE','INVITE_UNAVAILABLE','ROOM_LIMIT','INVALID_POOL'].includes(e.code)) {
        pending = null; localStorage.removeItem(PREFIX + 'pending');
      }
      showError(e);
      if (['STALE_STATE','ROUND_FINISHED'].includes(e.code)) { try { adopt((await client.call({ action:'read',roomId:connection.id })).room); } catch {} }
      if (e.code === 'ROOM_UNAVAILABLE' || e.code === 'INVITE_UNAVAILABLE') { room = null; stopped = true; render(); }
    } finally { busy = false; if (catalogue) render(); schedule(); }
  }
  function endRoom() { tick(); anchor = null; room = null; connection = null; invite = null; pending = null; stopped = true; clearTimeout(timer);
    localStorage.removeItem(PREFIX+'connection'); localStorage.removeItem(PREFIX+'pending');sessionStorage.removeItem(PREFIX+'invite');render();alertText('Pokój zamknięty. Zapisany wynik w historii zostaje na tym urządzeniu.'); }
  function schedule() { clearTimeout(timer); if (!stopped && connection && enabled() && !document.hidden && room?.phase !== 'matched') timer = setTimeout(sync, pending ? 4000 : room?.phase === 'waiting' ? 5000 : 2500); }
  async function sync() {
    if (busy || !connection || !enabled() || document.hidden) { schedule(); return; }
    if (pending) { await dispatch(pending); return; }
    busy = true;
    try { const value = await client.call({action:'read',roomId:connection.id}); adopt(value.room); alertText(''); }
    catch(e) { showError(e); if (e.code === 'ROOM_UNAVAILABLE') { stopped = true; room = null; render(); } }
    finally { busy = false; if(catalogue) render(); schedule(); }
  }
  function details(id) { const m=movie(id); $('#duo-dialog-content').innerHTML=`<h2>${esc(m.title)}</h2><p>${esc(meta(m))}</p><p>${esc(m.description || 'Brak opisu w źródle.')}</p>${room?.phase==='matched' ? m.offers.filter(o=>room.services.includes(o.provider)).map(o=>`<p><a data-open-platform href="${esc(safe(o.url))}" target="_blank" rel="noopener noreferrer">${esc(o.name)} ↗</a></p>`).join('') : ''}`;$('#duo-dialog').showModal(); }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-duo]');
    if (event.target.closest('[data-open-platform]') && room?.winner) {
      const rows = read(OLD+'journal.v02',[]), r=rows.find(x=>x.id==='duo-'+room.id); if(r){r.openedAt ||= new Date().toISOString();save(OLD+'journal.v02',rows);} return;
    }
    if (!button || button.disabled) return;
    const d = button.dataset, action = d.duo;
    try {
      if (action === 'details') { details(d.film); return; }
      if (action === 'seen') { seen = seen.includes(d.film) ? seen.filter(id=>id!==d.film) : [...seen,d.film];save(OLD+'seen',seen);render();return; }
      if (action === 'service') { choices = choices.includes(d.service) ? choices.filter(x=>x!==d.service) : [...choices,d.service];render();return; }
      if (action === 'share' || action === 'copy') {
        if (action === 'share' && navigator.share) { try { await navigator.share({title:'Seans — wybierzmy film',text:'Wybierzmy razem film na wieczór.',url:link()});return; } catch(e){if(e.name==='AbortError')return;} }
        try { await navigator.clipboard.writeText(link());alertText('Link zaproszenia skopiowany.'); } catch { alertText('Zaznacz i skopiuj link widoczny pod przyciskami.'); } return;
      }
      if (action === 'retry') { stopped = false; if(pending)await dispatch(pending);else await sync();return; }
      if (busy || pending) { showError({code:'REQUEST_PENDING'}); return; }
      if (action === 'create') {
        const ids=SeansCore.shuffle(catalogue.movies.filter(m=>m.offers.some(o=>choices.includes(o.provider)))).slice(0,104).map(m=>m.id);
        const secret=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
        connection={id:crypto.randomUUID(),secret};save(PREFIX+'connection',connection);stopped=false;
        await dispatch({action:'create',roomId:connection.id,invite:secret,ids,services:choices,catalogueAt:catalogue.fetchedAt});return;
      }
      if (action === 'join') { connection={id:invite.id};save(PREFIX+'connection',connection);stopped=false;
        await dispatch({action:'join',roomId:invite.id,invite:invite.secret});if(room){sessionStorage.removeItem(PREFIX+'invite');invite=null;}return; }
      if (!room) return;
      await dispatch({action:'command',roomId:room.id,command:{opId:crypto.randomUUID(),seq:room.self?.seq || 0,round:room.round,type:action,filmId:d.film,accept:d.accept==='true'}}, action==='pick' ? d.film : null);
    } catch(e){showError(e);}
  });
  $('#duo-help').addEventListener('click',()=>{ $('#duo-dialog-content').innerHTML='<h2>Oglądamy razem</h2><p>Każde z Was dostaje te same filmy, ale w innej kolejności. Zwycięzca zostaje. „Widziałem” tylko oznacza film; „Tego dziś nie chcę” wyklucza go z propozycji w tej rundzie dla Was obojga.</p><p>Po Waszych pojedynkach pojawią się maksymalnie trzy propozycje. Aplikacja nie zgaduje zgody: finał powstaje wyłącznie, kiedy obie osoby klikną „Tak” przy tym samym filmie.</p><p>'+privacy()+' Głosów drugiej osoby nie pokazujemy. Przekazuj zaproszenie tylko jednej zaufanej osobie. Każde może zamknąć pokój. Zamknięcie usuwa z serwera jego listę filmów i głosy; techniczny zapis pokoju pozostaje do wygaśnięcia.</p>';$('#duo-dialog').showModal(); });
  $('#duo-dialog-close').addEventListener('click',()=>$('#duo-dialog').close());
  $('#duo-close').addEventListener('click',async()=>{if(room&&!busy&&confirm('Zamknąć pokój dla obojga? Wynik zapisany na telefonach zostanie.'))await dispatch({action:'command',roomId:room.id,command:{opId:crypto.randomUUID(),seq:room.self?.seq||0,round:room.round,type:'close'}});});
  document.addEventListener('visibilitychange',()=>{tick();if(document.hidden)clearTimeout(timer);else void sync();});
  addEventListener('pagehide',()=>{tick();anchor=null;clearTimeout(timer);});addEventListener('pageshow',()=>{tick();schedule();});
  async function init() {
    try { client=SeansRoomClient.create(window.SEANS_ROOM_CONFIG); } catch(e){configError=e;}
    try { const r=await fetch('catalog.json',{cache:'no-cache',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();catalogue=await r.json(); }
    catch { catalogue=await window.SeansCache?.get(); }
    if (!catalogue?.movies?.length) { $('#duo-main').innerHTML='<section class="duo-center"><h1>Brak katalogu.</h1><p>Sprawdź połączenie i otwórz ponownie Seans.</p></section>';return; }
    films=new Map(catalogue.movies.map(m=>[m.id,m]));render();
    if (connection && !invite && enabled()) { stopped=false;await sync(); }
    else if (connection && invite?.id===connection.id && enabled()) { stopped=false;await sync(); if(room){invite=null;sessionStorage.removeItem(PREFIX+'invite');} }
  }
  // Read-only diagnostic data, no auth tokens or invitation secrets.
  window.SeansTogether={status:()=>({phase:room?.phase || 'setup',roomId:room?.id,revision:room?.revision,round:room?.round,role:room?.role,busy,pending:!!pending,configured:!!enabled()})};
  void init();
})();
