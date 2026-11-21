import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync('extension/bridge.js', 'utf8');
async function run(runtime, message = {id:'1', action:'status'}) {
  let listener, result;
  const window = {addEventListener:(_, fn) => {listener=fn;}, postMessage:data=>{result=data;}};
  const location = {origin:'https://animator-wine.vercel.app'};
  vm.runInNewContext(script, {window, location, chrome:{runtime}});
  await listener({source:window,origin:location.origin,data:{source:'motion-studio-request',...message}});
  return result;
}
const invalid = await run(undefined);
assert.equal(invalid.response.code, 'BRIDGE_INVALIDATED');
assert.match(invalid.response.error, /Refresh/);
const alive = await run({id:'abc',sendMessage:async()=>({ok:true})});
assert.equal(alive.response.ok,true);
const rejected = await run({id:'abc',sendMessage:async()=>{throw Error('Extension context invalidated.');}});
assert.equal(rejected.response.code,'BRIDGE_INVALIDATED');
const failure = await run({id:'abc',sendMessage:async()=>{throw Error('Network unavailable');}});
assert.equal(failure.response.error,'Network unavailable');
assert.equal(await run(undefined,{id:'1',action:'unknown'}),undefined);
console.log('Bridge invalidation checks passed');
