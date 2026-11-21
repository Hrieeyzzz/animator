import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
assert(manifest.content_scripts[0].matches.includes('https://animator-wine.vercel.app/*'));
const script = readFileSync('extension/popup.js', 'utf8');
async function connect(url) {
  const elements = Object.fromEntries(['#status','#character','#connect','#disconnect'].map(id => [id, {value:'', textContent:''}]));
  let saved;
  const chrome = { storage: { local: { get: async () => ({characterId:'character-123'}), set: async data => { saved = data; }, remove: async () => {} } }, tabs: { query: async () => [{url}] } };
  vm.runInNewContext(script, {chrome, document:{querySelector: id => elements[id]}, URL});
  elements['#character'].value='character-123';
  await elements['#connect'].onclick();
  return {saved, status:elements['#status'].textContent};
}
for (const url of ['https://animator-wine.vercel.app/', 'https://5173-example.e2b.app/', 'http://localhost:5173/']) {
  const result = await connect(url);
  assert.equal(result.saved?.approvedOrigin, new URL(url).origin, url);
}
for (const url of ['https://animator-wine.vercel.app.evil.example/', 'https://other.vercel.app/', 'http://animator-wine.vercel.app/']) {
  const result = await connect(url);
  assert.equal(result.saved, undefined, url);
}
console.log('Extension origin checks passed');
