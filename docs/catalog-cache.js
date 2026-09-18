/* IndexedDB avoids putting a multi-megabyte catalogue into localStorage.
   This is only a dated offline fallback, never marked as a live fetch. */
(function(root){
 'use strict';
 function open(){return new Promise((resolve,reject)=>{
  if(!root.indexedDB){reject(Error('IndexedDB unavailable'));return;}
  const request=root.indexedDB.open('seans.catalogue.v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('cache');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });}
 async function get(){let db;try{db=await open();return await new Promise(resolve=>{
  const r=db.transaction('cache').objectStore('cache').get('PL');
  r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);
 });}catch{return null;}finally{db?.close();}}
 async function put(value){let db;try{db=await open();return await new Promise(resolve=>{
  const t=db.transaction('cache','readwrite');t.objectStore('cache').put(value,'PL');
  t.oncomplete=()=>resolve(true);t.onerror=t.onabort=()=>resolve(false);
 });}catch{return false;}finally{db?.close();}}
 root.SeansCache={get,put};
})(window);
