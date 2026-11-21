import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
const script = readFileSync('extension/background.js', 'utf8');
let listener, requested;
const chrome = {runtime:{onMessage:{addListener:fn=>listener=fn}}, storage:{local:{get:async()=>({approvedOrigin:'https://animator-wine.vercel.app',characterId:'character-id'})}},tabs:{query:async()=>[{id:1}]},scripting:{executeScript:async()=>[{result:{downloadUrl:'https://mixamo-storage-prod.s3-us-west-2.amazonaws.com/system/tmp/file.fbx?signature=secret'}}]}};
const ctx = vm.createContext({chrome,URL,Uint8Array,btoa,fetch:async (url,options)=>{requested={url,options};return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}});
vm.runInContext(script,ctx);
function send(){return new Promise(resolve=>listener({action:'download',payload:{id:'123',name:'Walk'}},{url:'https://animator-wine.vercel.app/'},resolve));}
const result = await send();
assert.equal(result.data,'AQID');
assert.equal(result.downloadUrl,undefined);
assert.equal(requested.options.credentials,'omit');
assert.equal(requested.options.redirect,'error');
assert(manifest.host_permissions.includes('https://mixamo-storage-prod.s3-us-west-2.amazonaws.com/*'));
chrome.scripting.executeScript=async()=>[{result:{downloadUrl:'https://attacker.example/file'}}];
const rejected = await send();
assert.match(rejected.error,/unsupported download host/);
assert.equal(requested.url.includes('attacker'), false);
console.log('Extension download bridge checks passed');
// Exercise the Mixamo-side stages without a real account or network.
const calls=[];
const mixamoContext = vm.createContext({
  chrome:{runtime:{onMessage:{addListener:()=>{}}}},
  localStorage:{getItem:()=> 'test-token'}, URL, Uint8Array, btoa,
  location:{origin:'https://www.mixamo.com'},
  setTimeout:fn=>fn(),
  fetch:async (path, options)=>{
    calls.push({path,options});
    if (path.startsWith('/api/v1/products/')) return {ok:true,json:async()=>({details:{gms_hash:{params:[['foo',42]]}}})};
    if (path === '/api/v1/animations/export') return {ok:true,json:async()=>({})};
    if (path.includes('/monitor')) return {ok:true,json:async()=>({status:'completed',job_result:'https://mixamo-storage-prod.s3-us-west-2.amazonaws.com/export.fbx?secret=abc'})};
    throw Error('Unexpected request');
  }
});
vm.runInContext(script,mixamoContext);
const generated=await mixamoContext.mixamoRequest('download',{productId:'42',characterId:'character-id',name:'Walk'});
assert.match(generated.downloadUrl,/mixamo-storage-prod/);
assert.equal(calls.length,3);
assert.equal(JSON.parse(calls[1].options.body).gms_hash[0].params,'42');
assert.equal(calls[2].path,'/api/v1/characters/character-id/monitor');
assert(!calls.some(c=>String(c.path).startsWith('https://')));
console.log('Mixamo export stages passed with simulated responses');
