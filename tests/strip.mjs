import fs from 'fs';
// Strip texture/material data so GLTFLoader can parse headlessly in Node.
export function stripGlb(path){
  const b = fs.readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20,20+jsonLen).toString('utf8'));
  const binStart = 20+jsonLen+8;
  delete json.images; delete json.textures; delete json.samplers;
  json.materials = [{ pbrMetallicRoughness: { baseColorFactor: [0.8,0.8,0.8,1], metallicFactor: 0 } }];
  for (const m of json.meshes||[]) for (const p of m.primitives||[]) { p.material = 0; delete p.targets; }
  return { json, bin: b.slice(binStart) };
}
