/** Local test server. Random test sessions replace Supabase Auth ONLY in this file.
 * Actual room handler and storage SQL are the production code under test.
 */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {makeHandler} from '../supabase/functions/_shared/room-handler.mjs';import {memoryStore,postgresStore} from './room-test-store.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../docs'),tokens=new Map();
const store=process.env.TEST_DATABASE_URL?postgresStore():memoryStore();let origin;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
let handler;
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,origin),p=url.pathname;
 if(req.method==='POST'&&p.startsWith('/auth/v1/')){const token=randomUUID()+randomUUID(),user=randomUUID();tokens.set(token,user);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({access_token:token,refresh_token:randomUUID(),expires_in:3600}));return;}
 if(p==='/functions/v1/seans-room'){
  const chunks=[];for await(const c of req)chunks.push(c);
  const result=await handler(new Request(origin+p,{method:req.method,headers:req.headers,body:Buffer.concat(chunks),duplex:'half'}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
 }
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 if(p==='/room-config.js'){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});res.end('window.SEANS_ROOM_CONFIG='+JSON.stringify({enabled:true,supabaseUrl:origin,publishableKey:'test-public-key',siteOrigin:origin})+';');return;}
 const file=path.resolve(root,'.'+decodeURIComponent(p==='/'?'/together.html':p));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(500);res.end('Test server error');}
});
server.listen(0,'127.0.0.1',()=>{origin='http://127.0.0.1:'+server.address().port;handler=makeHandler({store,allowedOrigins:[origin],authenticate:async bearer=>tokens.get(bearer.replace(/^Bearer /,''))||null});console.log(JSON.stringify({url:origin,storage:process.env.TEST_DATABASE_URL?'PostgreSQL':'in-memory-test-adapter'}));});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
