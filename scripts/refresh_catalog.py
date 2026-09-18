"""Poland-only subscription catalogue for the independent non-commercial Seans prototype.
The website interface is unofficial. Failed refreshes never relabel old data as fresh.
"""
import concurrent.futures, datetime as dt, json, os, pathlib, time, urllib.error, urllib.request
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
            req=urllib.request.Request(API,data=payload,headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'Seans-PrivatePrototype/0.2.1 (non-commercial catalogue test)'})
            with urllib.request.urlopen(req,timeout=35) as r:result=json.load(r)
            if result.get('errors'):raise ValueError(json.dumps(result['errors'],ensure_ascii=False))
            return result['data']
        except urllib.error.HTTPError as exc:
            if exc.code in (401,403,429) or attempt==2:raise
            time.sleep(2**attempt)
        except (urllib.error.URLError,TimeoutError):
            if attempt==2:raise
            time.sleep(2**attempt)
QUERY='''query Movies($packages: [String!]!) {
 popularTitles(country: PL, first: 100, sortBy: POPULAR,
 filter: {objectTypes: [MOVIE], packages: $packages, monetizationTypes: [FLATRATE]}) {
 totalCount edges { node { id
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
    packages=graphql('query { packages(country: PL, platform: WEB) { shortName clearName } }')['packages']
    providers=[]
    for key,names in WANTED:
        found=next((p for name in names for p in packages if p['clearName'].casefold()==name.casefold()),None)
        if not found:raise ValueError('Cannot resolve Polish provider '+key)
        providers.append({'id':key,'code':found['shortName'],'name':found['clearName']})
    mapping={p['code']:p['id'] for p in providers}
    started=dt.datetime.now(dt.timezone.utc).isoformat()
    def fetch_provider(provider):
        data=graphql(QUERY,{'packages':[provider['code']]})['popularTitles']
        entries=[]
        for edge in data['edges']:
            n=edge['node'];c=n['content']
            if not c.get('fullPath','').startswith('/pl/'):raise ValueError('Non-Polish title')
            offers=[];used=set()
            for o in n.get('offers',[]):
                service=mapping.get(o['package']['shortName']);url=o.get('standardWebURL','');parsed=urlparse(url)
                if service and service not in used and o['monetizationType']=='FLATRATE' and parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.password:
                    used.add(service);offers.append({'provider':service,'name':o['package']['clearName'],'url':url})
            if provider['id'] not in used:continue
            score=c.get('scoring') or {};poster=c.get('posterUrl') or ''
            entries.append({'id':n['id'],'title':c['title'],'year':c.get('originalReleaseYear'),'runtime':c.get('runtime'),'description':c.get('shortDescription') or '',
            'poster':('https://images.justwatch.com'+poster.replace('{profile}','s592').replace('{format}','jpg')) if poster.startswith('/poster/') else '',
            'url':'https://www.justwatch.com'+c['fullPath'],'genres':[{'id':g['shortName'],'name':g['translation']} for g in c.get('genres',[])],
            'rating':score.get('imdbScore'),'votes':score.get('imdbVotes'),'imdbId':(c.get('externalIds') or {}).get('imdbId'),'offers':offers})
        if not entries:raise ValueError('No verified Polish subscription films for '+provider['name'])
        print(provider['name'], 'catalogue:',data['totalCount'],'sample:',len(entries),flush=True)
        return entries
    movies={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for entries in executor.map(fetch_provider,providers):
            for movie in entries:
                if movie['id'] not in movies:movies[movie['id']]=movie
                else:
                    old=movies[movie['id']];codes={o['provider'] for o in old['offers']}
                    old['offers'].extend(o for o in movie['offers'] if o['provider'] not in codes)
    if len(movies)<50:raise ValueError('Suspiciously small catalogue; previous file unchanged')
    result={'version':1,'country':'PL','monetization':'FLATRATE','fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'fetchStartedAt':started,'refreshHours':1,'source':'JustWatch website (unofficial, non-commercial prototype)','sampleLimitPerProvider':100,'providers':providers,'movies':list(movies.values())}
    temp=ROOT/'docs/catalog.tmp.json';temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(ROOT/'docs/catalog.json')
    print('Validated',len(movies),'films; timestamp',result['fetchedAt'],flush=True)
if __name__=='__main__':main()
