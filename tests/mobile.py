"""Actual browser checks; no mocked catalogue and no external playback or login."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from datetime import datetime,timezone
import threading,json,os,traceback,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'docs')))
threading.Thread(target=server.serve_forever,daemon=True).start()
urls=[('local',f'http://127.0.0.1:{server.server_port}/index.html')]
if os.environ.get('SEANS_PUBLIC_URL'):urls.append(('public',os.environ['SEANS_PUBLIC_URL']))
rows=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  browser=getattr(p,engine).launch()
  for mode,url in urls:
   row={'engine':engine,'browserVersion':browser.version,'mode':mode,'url':url,'passed':False,'checks':[],'errors':[],'physicalDevice':False};rows.append(row)
   ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='pl-PL',timezone_id='Europe/Warsaw',accept_downloads=True)
   page=ctx.new_page();page.on('pageerror',lambda e,r=row:r['errors'].append(str(e)))
   def check(name,condition=True):
    assert condition,name
    row['checks'].append(name);print(engine,mode,'PASS',name,flush=True)
   def idle():page.wait_for_function('!moving');page.wait_for_timeout(350)
   def click(selector):page.locator(selector).first.click()
   try:
    response=page.goto(url,wait_until='domcontentloaded',timeout=45000)
    row['httpStatus']=response.status;page.wait_for_timeout(1000)
    if page.title().startswith('External Content Notice'):
     assert page.locator('#phish-dest').input_value()==url
     page.get_by_role('button',name='Open the page',exact=True).click();row['hostingConfirmation']=True
    page.locator('[data-service="netflix"]').wait_for(timeout=40000)
    check('Version 0.2.1','0.2.1' in page.locator('.beta').inner_text())
    check('Sound off by default',page.evaluate('!audioEnabled'))
    check('Polish subscription catalogue',page.evaluate('catalogue.country==="PL" && catalogue.monetization==="FLATRATE" && catalogue.movies.length>=50'))
    row['catalogueCount']=page.evaluate('catalogue.movies.length');row['catalogueFetchedAt']=page.evaluate('catalogue.fetchedAt')
    click('[data-service="netflix"]');click('[data-rounds="10"]');click('[data-action="start"]')
    check('Two movie cards',page.locator('.movie').count()==2)
    page.evaluate('window.kept=document.querySelector(".movie")')
    click('[data-pick="0"]');idle()
    check('Winner stays in the same DOM node',page.evaluate('kept===document.querySelector(".movie") && game.completed===1'))
    page.locator('[data-pick="0"]').first.evaluate('el=>{el.click();el.click()}');idle()
    check('Double tap counted once',page.evaluate('game.completed===2 && session.events.length===2'))
    click('[data-action="undo"]');idle();check('Undo rolls back accounting',page.evaluate('game.completed===1 && session.events.length===1'))
    click('[data-seen="1"]');idle();check('Seen is not a vote',page.evaluate('game.completed===1 && seen.length===1'))
    click('[data-action="undo"]');idle();check('Undo seen restores list',page.evaluate('seen.length===0'))
    click('[data-action="skip"]');idle();check('Skip has no vote',page.evaluate('game.completed===1 && game.champion===null'))
    click('[data-action="undo"]');idle();click('[data-detail]')
    check('Description dialog opens',page.locator('dialog').is_visible());click('[data-action="close"]')
    click('[data-action="sound"]');page.wait_for_function('SeansSound.status().state==="running"')
    click('[data-pick="0"]');idle();check('Opt-in Web Audio plays effects',page.evaluate('SeansSound.status().played>=1'))
    click('[data-action="sound"]')
    try:
     page.wait_for_function('Array.from(document.querySelectorAll(".duel img")).some(i=>i.complete && i.naturalWidth>0)',timeout=12000);row['postersLoaded']=True
    except Exception:row['postersLoaded']=False
    page.screenshot(path=str(OUT/f'{engine}-{mode}-duel.png'),full_page=True)
    click('[data-action="finish"]');idle()
    check('Final statistics match votes',page.evaluate('screen==="winner" && journal.length===1 && journal[0].stats.decisions===2 && journal[0].stats.defeated===2'))
    page.screenshot(path=str(OUT/f'{engine}-{mode}-winner.png'),full_page=True)
    page.locator('[data-open]').first.evaluate('el=>{el.addEventListener("click",e=>e.preventDefault(),{once:true});el.click()}');page.wait_for_timeout(50)
    check('Opened is not watched',page.evaluate('!!journal[0].openedAt && !journal[0].watchedAt'))
    click('[data-watched]');click('[data-score="4"]');click('[data-action="save"]')
    check('Explicit watch, rating and saved movie',page.evaluate('!!journal[0].watchedAt && journal[0].score===4 && saved.length===1'))
    click('[data-action="library"]');check('History counters',page.locator('.library-stats strong').all_text_contents()[:3]==['1','1','1'])
    page.screenshot(path=str(OUT/f'{engine}-{mode}-history.png'),full_page=True)
    with page.expect_download() as download:click('[data-action="export"]')
    backup=json.loads(Path(download.value.path()).read_text())
    check('JSON export',backup['journal'][0]['score']==4 and len(backup['saved'])==1)
    page.reload();page.locator('[data-service="netflix"]').wait_for()
    check('History survives reload',page.evaluate('journal.length===1 && journal[0].score===4'))
    click('[data-action="start"]');click('[data-pick="0"]');idle();page.evaluate('tick();persist()');before=page.evaluate('session.elapsedMs')
    page.reload();page.locator('[data-action="resume"]').wait_for();page.wait_for_timeout(600);click('[data-action="resume"]')
    check('Resume excludes idle home time',abs(page.evaluate('session.elapsedMs')-before)<400)
    page.emulate_media(reduced_motion='reduce');idle();click('[data-pick="1"]');idle()
    check('Reduced motion works',page.evaluate('reduceMotion() && game.completed===2'))
    page.set_viewport_size({'width':320,'height':740});check('Small-screen layout',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    for _ in range(12):
     if page.evaluate('screen!=="duel"'):break
     click('[data-pick="0"]');idle()
    check('Ten choices reach final',page.evaluate('game.completed===10 && screen==="winner"'))
    click('[data-action="more"]');idle();click('[data-pick="0"]');idle();click('[data-action="finish"]');idle()
    check('Continue without duplicate records',page.evaluate('journal.length===2 && journal[0].stats.decisions===11'))
    check('No JavaScript errors',not row['errors']);row['passed']=True
   except Exception as exc:
    row['failure']=str(exc);row['traceback']=traceback.format_exc()
    try:
     row['pageTitle']=page.title();row['pageText']=page.locator('body').inner_text()[:2000]
     page.screenshot(path=str(OUT/f'{engine}-{mode}-failure.png'),full_page=True)
    except Exception:pass
   finally:ctx.close()
  browser.close()
server.shutdown()
report={'version':'0.2.1','testedAt':datetime.now(timezone.utc).isoformat(),'sourceCommit':os.environ.get('GITHUB_SHA'),'results':rows}
(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
if not all(r['passed'] for r in rows):sys.exit(1)
