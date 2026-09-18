'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),project=JSON.parse(fs.readFileSync(path.join(root,'project.json'),'utf8'));
function check(ok,msg){if(!ok)throw Error(msg);}
check(project.repository==='KADARstudio/seans'&&project.repositoryId===1376451444,'Wrong project identity');
if(process.env.GITHUB_REPOSITORY)check(process.env.GITHUB_REPOSITORY==='KADARstudio/seans','Wrong repository');
if(process.env.GITHUB_REPOSITORY_ID)check(process.env.GITHUB_REPOSITORY_ID==='1376451444','Wrong stable repository ID');
const probe=cp.spawnSync('git',['-C',root,'rev-parse','--show-toplevel'],{encoding:'utf8'});
if(probe.status===0){
 check(path.resolve(probe.stdout.trim())===root,'Refusing nested repository');
 const remotes=cp.spawnSync('git',['-C',root,'remote','-v'],{encoding:'utf8'});
 check(remotes.status===0,'Could not verify remotes');
 for(const row of remotes.stdout.trim().split('\n').filter(Boolean))check(/^(https:\/\/github\.com\/|git@github\.com:)KADARstudio\/seans(?:\.git)?\/?$/i.test(row.split(/\s+/)[1]),'Wrong remote');
}
for(const file of fs.readdirSync(path.join(root,'docs'))){
 if(!/\.(html|js|css)$/.test(file))continue;
 check(!/WycenaSesji|kadr-i-wartosc|\/foodcost\//i.test(fs.readFileSync(path.join(root,'docs',file),'utf8')),'Cross-project runtime reference');
}
const file=path.join(root,'docs/catalog.json');
if(fs.existsSync(file)){
 const c=JSON.parse(fs.readFileSync(file,'utf8'));
 check(c.country==='PL'&&c.monetization==='FLATRATE'&&c.movies.length>=50,'Invalid catalogue');
 check(new Set(c.movies.map(m=>m.id)).size===c.movies.length,'Duplicate titles');
 check(c.movies.every(m=>m.url.startsWith('https://www.justwatch.com/pl/')&&m.offers.length&&m.offers.every(o=>o.url.startsWith('https://')&&c.providers.some(p=>p.id===o.provider))),'Invalid offers');
}
console.log('PASS: repository name, stable ID, remotes, runtime isolation and catalogue');
