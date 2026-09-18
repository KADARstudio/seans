"""PL subscription catalogue with pagination and explicit source coverage.
Large result sets use normal release-year filters. Never retry authorization or
rate-limit failures; failed refreshes preserve the last dated catalogue.
"""
import datetime as dt,json,os,pathlib,time,urllib.error,urllib.request,sys
from urllib.parse import urlparse
ROOT=pathlib.Path(__file__).resolve().parents[1]
API='https://apis.justwatch.com/graphql'
WANTED=[('netflix',['Netflix']),('prime',['Amazon Prime Video']),('disney',['Disney Plus','Disney+']),('max',['HBO Max','Max']),('apple',['Apple TV','Apple TV Plus','Apple TV+']),('sky',['SkyShowtime'])]
def guard():
 p=json.loads((ROOT/'project.json').read_text())
 if p['repository']!='KADARstudio/seans' or p['repositoryId']!=1376451444:raise ValueError('Wrong project identity')
 if os.environ.get('GITHUB_REPOSITORY','KADARstudio/seans')!='KADARstudio/seans':raise ValueError('Wrong repository')
 if os.environ.get('GITHUB_REPOSITORY_ID','1376451444')!='1376451444':raise ValueError('Wrong repository ID')
def graphql(query,variables=None):
 payload=json.dumps({'query':query,'variables':variables or {}}).encode()
 for attempt in range(3):
  try:
   req=urllib.request.Request(API,data=payload,headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'Seans-PrivatePrototype/0.3.0 (non-commercial catalogue test)'})
   with urllib.request.urlopen(req,timeout=35) as r:result=json.load(r)
   if result.get('errors'):raise ValueError(json.dumps(result['errors'],ensure_ascii=False))
   return result['data']
  except urllib.error.HTTPError as exc:
   if exc.code in (401,403,429) or attempt==2:raise
   time.sleep(2**attempt)
  except (urllib.error.URLError,TimeoutError):
   if attempt==2:raise
   time.sleep(2**attempt)
QUERY='''query Movies($packages: [String!]!, $after: String) {
 popularTitles(country: PL, first: 100, after: $after, sortBy: POPULAR,
 filter: {objectTypes: [MOVIE], packages: $packages, monetizationTypes: [FLATRATE] YEAR_FILTER}) {
 totalCount pageInfo { hasNextPage endCursor } edges { node { id
 content(country: PL, language: pl) {
 title fullPath originalReleaseYear runtime shortDescription posterUrl
 genres { shortName translation(language: pl) }
 scoring { imdbScore imdbVotes } externalIds { imdbId }
 }
 offers(country: PL, platform: WEB, filter: {monetizationTypes: [FLATRATE]}) {
 standardWebURL monetizationType package { shortName clearName }
 }
 } }
 }
}'''
def main():
 guard()
 if '--if-stale' in sys.argv:
  try:
   old=json.loads((ROOT/'docs/catalog.json').read_text())
   age=(dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(old['fetchedAt'])).total_seconds()
   if old.get('coverage',{}).get('complete') and 0<=age<21600:
    print('Retaining complete dated catalogue younger than six hours',flush=True);return
  except (FileNotFoundError,ValueError,KeyError):pass
 packages=graphql('query { packages(country: PL, platform: WEB) { shortName clearName } }')['packages']
 providers=[]
 for key,names in WANTED:
  found=next((p for name in names for p in packages if p['clearName'].casefold()==name.casefold()),None)
  if not found:raise ValueError('Cannot resolve Polish provider '+key)
  providers.append({'id':key,'code':found['shortName'],'name':found['clearName']})
 mapping={p['code']:p['id'] for p in providers}
 started=dt.datetime.now(dt.timezone.utc).isoformat()
 def fetch_provider(provider):
  observed={};pages=0;segments=[]
  def collect(lo=None,hi=None,depth=0):
   nonlocal pages
   clause='' if lo is None else ', releaseYear: {min: '+str(int(lo))+', max: '+str(int(hi))+'}'
   query=QUERY.replace(' YEAR_FILTER',clause);after=None;cursors=set();local=set();expected=0
   while True:
    if pages:time.sleep(1.2)
    data=graphql(query,{'packages':[provider['code']],'after':after})['popularTitles'];pages+=1
    expected=max(expected,int(data['totalCount']))
    for edge in data['edges']:
     n=edge['node'];observed[n['id']]=n;local.add(n['id'])
    print(provider['name'],'range',lo,hi,'request',pages,'range unique',len(local),'reported',expected,flush=True)
    if after is None and expected>1800 and (lo is None or lo<hi):
     low=1800 if lo is None else lo;high=dt.datetime.now(dt.timezone.utc).year+1 if hi is None else hi
     if depth>=12:raise ValueError('Unexpected search depth')
     mid=(low+high)//2
     collect(low,mid,depth+1);collect(mid+1,high,depth+1)
     return expected
    info=data['pageInfo']
    if not info['hasNextPage']:
     segments.append({'minYear':lo,'maxYear':hi,'reportedCount':expected,'fetchedCount':len(local),'complete':len(local)>=expected})
     return expected
    after=info.get('endCursor')
    if not after or after in cursors or not data['edges']:raise ValueError('Pagination did not advance; previous file unchanged')
    cursors.add(after)
    if pages>=300:raise ValueError('Safety limit reached; refusing truncated catalogue')
  expected=collect();entries=[];excluded=0
  for n in observed.values():
   c=n['content']
   if not c.get('fullPath','').startswith('/pl/'):raise ValueError('Non-Polish title')
   offers=[];used=set()
   for o in n.get('offers',[]):
    service=mapping.get(o['package']['shortName']);url=o.get('standardWebURL','');parsed=urlparse(url)
    if service and service not in used and o['monetizationType']=='FLATRATE' and parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.password:
     used.add(service);offers.append({'provider':service,'name':o['package']['clearName'],'url':url})
   if provider['id'] not in used:excluded+=1;continue
   score=c.get('scoring') or {};poster=c.get('posterUrl') or ''
   entries.append({'id':n['id'],'title':c['title'],'year':c.get('originalReleaseYear'),'runtime':c.get('runtime'),'description':c.get('shortDescription') or '',
   'poster':('https://images.justwatch.com'+poster.replace('{profile}','s592').replace('{format}','jpg')) if poster.startswith('/poster/') else '',
   'url':'https://www.justwatch.com'+c['fullPath'],'genres':[{'id':g['shortName'],'name':g['translation']} for g in c.get('genres',[])],
   'rating':score.get('imdbScore'),'votes':score.get('imdbVotes'),'imdbId':(c.get('externalIds') or {}).get('imdbId'),'offers':offers})
  if not entries:raise ValueError('No verified Polish films for '+provider['name'])
  return entries,{'id':provider['id'],'name':provider['name'],'reportedCount':expected,'fetchedCount':len(observed),'acceptedCount':len(entries),'excludedWithoutOffer':excluded,'pages':pages,'segments':segments,'paginationExhausted':True,'complete':len(observed)>=expected and excluded==0 and all(s['complete'] for s in segments)}
 movies={};reports=[]
 for provider in providers:
  entries,report=fetch_provider(provider);reports.append(report)
  for movie in entries:
   if movie['id'] not in movies:movies[movie['id']]=movie
   else:
    old=movies[movie['id']];codes={o['provider'] for o in old['offers']}
    old['offers'].extend(o for o in movie['offers'] if o['provider'] not in codes)
 if len(movies)<50:raise ValueError('Suspiciously small catalogue; previous file unchanged')
 result={'version':1,'country':'PL','monetization':'FLATRATE','fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'fetchStartedAt':started,'refreshHours':6,'source':'JustWatch website (unofficial, non-commercial prototype)','sampleLimitPerProvider':None,'coverage':{'complete':all(p['complete'] for p in reports),'providers':reports,'note':'All exposed pages traversed, with release-year partitions for large sets. Upstream availability may lag platforms.'},'providers':providers,'movies':list(movies.values())}
 temp=ROOT/'docs/catalog.tmp.json';temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(ROOT/'docs/catalog.json')
 print('Validated',len(movies),'films; timestamp',result['fetchedAt'],flush=True);print(json.dumps(result['coverage'],ensure_ascii=False),flush=True)
if __name__=='__main__':main()
