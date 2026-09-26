"""Two isolated browsers, real room handler and a local PostgreSQL backend in CI.
Supabase Auth is replaced only by test sessions in tests/room-server.mjs.
This is not proof of hosted Supabase or physical iPhone operation.
"""
import json, os, pathlib, subprocess, traceback
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'test-results-v04';OUT.mkdir(exist_ok=True)
proc=subprocess.Popen(['node',str(ROOT/'tests/room-server.mjs')],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
info=json.loads(proc.stdout.readline());URL=info['url'];results=[]
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   row={'engine':engine,'checks':[],'passed':False,'javascriptErrors':[]};results.append(row)
   browser=getattr(p,engine).launch()
   ca=browser.new_context(viewport={'width':390,'height':664},is_mobile=True,has_touch=True,locale='pl-PL')
   cb=browser.new_context(viewport={'width':390,'height':664},is_mobile=True,has_touch=True,locale='pl-PL')
   a,b=ca.new_page(),cb.new_page()
   for page in [a,b]:page.on('pageerror',lambda err,r=row:r['javascriptErrors'].append(str(err)))
   def ok(name,value=True):
    assert value,name
    row['checks'].append(name)
   def idle(page):page.wait_for_function('window.SeansTogether && !SeansTogether.status().busy',timeout=25000)
   def phase(page):return page.evaluate('SeansTogether.status().phase')
   def wait_phase(page,target):page.wait_for_function('(p)=>SeansTogether.status().phase===p',arg=target,timeout=20000)
   def start():
    a.goto(URL+'/together.html');a.wait_for_selector('[data-duo="service"]')
    a.locator('[data-duo="service"][data-service="netflix"]').click();a.locator('[data-duo="create"]').click();wait_phase(a,'waiting');idle(a)
    invite=a.locator('.duo-link').inner_text();b.goto(invite);b.wait_for_selector('[data-duo="join"]');b.locator('[data-duo="join"]').click();wait_phase(b,'picking');idle(b);wait_phase(a,'picking');idle(a)
    return invite
   def finish(page):
    for _ in range(20):
     idle(page)
     if page.locator('.duo-card').count()==0:return
     page.locator('.duo-card [data-duo="pick"].primary').first.click();idle(page)
    raise AssertionError('Unbounded tournament')
   try:
    invitation=start();ok('One invite connects two independent browser contexts',a.evaluate('SeansTogether.status().role')=='a' and b.evaluate('SeansTogether.status().role')=='b')
    ok('Invitation secret removed from guest address',not b.evaluate('location.hash'))
    try:
     a.wait_for_function("Array.from(document.querySelectorAll('.duo-card img')).some(i=>i.complete&&i.naturalWidth>0)",timeout=12000)
     row['realPostersLoaded']=True
    except Exception:row['realPostersLoaded']=False
    a.screenshot(path=str(OUT/f'{engine}-together-duel.png'))
    a.evaluate('window.savedWinner=document.querySelectorAll(".duo-card")[0]')
    first=a.locator('.duo-card').first.get_attribute('data-film');rev=a.evaluate('SeansTogether.status().revision')
    a.locator('[data-duo="seen"]').first.click()
    ok('Seen marks locally without changing room or pair',a.locator('.duo-card').first.get_attribute('data-film')==first and a.evaluate('SeansTogether.status().revision')==rev)
    a.locator('.duo-card [data-duo="pick"].primary').first.evaluate('el=>{el.click();el.click()}');idle(a)
    ok('Winner DOM node is retained',a.evaluate('savedWinner===document.querySelectorAll(".duo-card")[0]'))
    ok('Double tap registers one choice','1/' in a.locator('.duo-state').inner_text())
    ok('Other participant has not inherited that choice','0/' in b.locator('.duo-state').inner_text())
    a.locator('[data-duo="undo"]').click();idle(a);ok('Undo restores own decision count','0/' in a.locator('.duo-state').inner_text())
    for width,height in [(390,664),(375,548),(320,480)]:
     a.set_viewport_size({'width':width,'height':height});a.wait_for_timeout(50)
     ok(f'All voting controls within {width}x{height}',a.evaluate("Array.from(document.querySelectorAll('.duo-card button,.duo-bottom button')).every(el=>{const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.height>=44})"))
     ok(f'No document horizontal overflow at {width}',a.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    a.set_viewport_size({'width':390,'height':664})
    id_before=a.locator('.duo-card').first.get_attribute('data-film');a.reload();wait_phase(a,'picking');idle(a)
    ok('Reload restores the same room and current pair',a.locator('.duo-card').first.get_attribute('data-film')==id_before)
    ca.set_offline(True);a.locator('.duo-card [data-duo="pick"].primary').first.click();a.wait_for_timeout(1000)
    ok('Offline decision retained in persistent outbox',a.evaluate('SeansTogether.status().pending'))
    ca.set_offline(False);a.reload();wait_phase(a,'picking');idle(a)
    a.wait_for_function('!SeansTogether.status().pending',timeout=20000);ok('Pending vote delivered exactly once after reconnect','1/' in a.locator('.duo-state').inner_text())
    outsider=browser.new_context(viewport={'width':390,'height':664});third=outsider.new_page();third.goto(invitation);third.wait_for_selector('[data-duo="join"]');third.locator('[data-duo="join"]').click();third.wait_for_selector('#duo-alert:not([hidden])');idle(third)
    ok('Third device cannot enter the occupied room','dwie osoby' in third.locator('#duo-alert').inner_text());outsider.close()
    veto=a.locator('.duo-card').last.get_attribute('data-film');a.locator('[data-duo="veto"]').last.click();idle(a)
    finish(a);ok('One participant finishing does not invent a result',phase(a)=='picking' and not a.locator('.duo-card').count())
    finish(b);wait_phase(a,'confirming');wait_phase(b,'confirming');idle(a);idle(b)
    ok('Veto excluded from shared proposals',a.locator(f'[data-candidate="{veto}"]').count()==0)
    a.screenshot(path=str(OUT/f'{engine}-together-confirm.png'))
    candidate=a.locator('[data-candidate]').first.get_attribute('data-candidate')
    a.locator(f'[data-duo="answer"][data-film="{candidate}"][data-accept="true"]').click();idle(a)
    ok('One explicit yes is not a final',phase(a)=='confirming')
    b.locator(f'[data-duo="answer"][data-film="{candidate}"][data-accept="true"]').click();idle(b);wait_phase(a,'matched');idle(a)
    ok('Two explicit yes votes produce one identical result',a.locator('.duo-center h2').inner_text()==b.locator('.duo-center h2').inner_text())
    ok('Final actions fit on the phone',a.evaluate("Array.from(document.querySelectorAll('.duo-watch a,.duo-center .secondary')).every(el=>el.getBoundingClientRect().bottom<=innerHeight)"))
    a.screenshot(path=str(OUT/f'{engine}-together-final.png'))
    a.reload();wait_phase(a,'matched');idle(a);ok('Confirmed result survives reload')
    ok('Local journal records chosen, not watched',a.evaluate("(()=>{const r=JSON.parse(localStorage.getItem('seans.prototype.v1.journal.v02'))[0];return r.mode==='together'&&!r.watchedAt&&!r.openedAt;})()"))
    a.once('dialog',lambda d:d.accept());a.locator('#duo-close').click();idle(a)
    ok('Closing ends the room on the first device',phase(a)=='setup')
    b.reload();b.wait_for_selector('#duo-alert:not([hidden])');idle(b)
    ok('Closed room cannot be resumed on the second device','wygasł' in b.locator('#duo-alert').inner_text())
    ok('No application JavaScript errors',not row['javascriptErrors']);row['passed']=True
   except Exception as e:
    row['failure']=str(e);row['traceback']=traceback.format_exc()
    try:a.screenshot(path=str(OUT/f'{engine}-failure.png'),full_page=True)
    except Exception:pass
   finally:browser.close()
finally:
 proc.terminate()
 try:proc.wait(timeout=10)
 except subprocess.TimeoutExpired:proc.kill()
report={'version':'0.4-test','commit':os.environ.get('GITHUB_SHA'),'testedAt':datetime.now(timezone.utc).isoformat(),'storage':info['storage'],'authentication':'test identity adapter, NOT hosted Supabase Auth','physicalPhoneTest':False,'results':results}
(OUT/'together-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if not all(r['passed'] for r in results):raise SystemExit(1)
