import { isInPlaceDropTrack, remainingDriftTracks, nodeOfTrack } from '../src/lib/drift.js';

let fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) fail++;
};

const drop = [
  'mixamorigHips.position',
  'mixamorig:Hips.position',
  'mixamorig:Hips_1.position',
  'Hips.position',
  'Pelvis.position',
  'mixamorig1Pelvis.position',
  'Armature.position',
  'Node-0.position',
  'Node 0.position',
  'Root.position',
  'Scene.position',
  'mixamorigHips.position'.toUpperCase(),
];
const keep = [
  'mixamorigSpine1.position',
  'mixamorigSpine2.position',
  'mixamorigLeftFoot.position',
  'mixamorigRightUpLeg.position',
  'mixamorigHips.quaternion',
  'mixamorigHips.scale',
];
for (const t of drop) check(`drop ${t}`, isInPlaceDropTrack(t));
for (const t of keep) check(`keep ${t}`, !isInPlaceDropTrack(t));

check('nodeOfTrack splits at last dot', nodeOfTrack('a.b/cHips_1.position') === 'a.b/cHips_1');

// remainingDriftTracks agrees with the filter
const fakeClip = {
  tracks: ['mixamorigHips.position', 'mixamorigSpine1.position', 'Armature.position']
    .map((name) => ({ name })),
};
check('remainingDriftTracks finds origin tracks', remainingDriftTracks(fakeClip).join(',') ===
  'mixamorigHips.position,Armature.position');

console.log(fail ? `\n${fail} check(s) failed` : '\n all checks passed');
process.exit(fail ? 1 : 0);
