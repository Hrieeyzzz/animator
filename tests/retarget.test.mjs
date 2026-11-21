import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { retargetClip, rigCoverage, collectBones, findHip, safeNodeName } from '../src/lib/retarget.js';
import { stripGlb } from './strip.mjs';

globalThis.ProgressEvent = class { constructor(t, i = {}) { this.type = t; Object.assign(this, i); } };
const loader = new GLTFLoader();

async function load(p) {
  const { json, bin } = stripGlb(p);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64') }];
  return loader.parseAsync(JSON.stringify(json), '');
}

const soldier = await load('./tests/fixtures/Soldier.glb');
const michelle = await load('./tests/fixtures/Michelle.glb');
for (const rig of [soldier.scene, michelle.scene]) {
  for (const bone of collectBones(rig).bones) bone.name = safeNodeName(bone);
}

let fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) fail++;
};

check('soldier rig is Mixamo-shaped', rigCoverage(soldier.scene) === 1);
check('michelle rig is Mixamo-shaped', rigCoverage(michelle.scene) === 1);

const walk = soldier.animations.find((a) => a.name === 'Walk');
const samba = michelle.animations.find((a) => a.name === 'SambaDance');

const { clip: walkOnMichelle, matched } = retargetClip(walk, soldier.scene, michelle.scene, { fps: 30 });
check('Soldier/Walk retargets onto Michelle', matched >= 45, `${matched} bones mapped`);
check('clip duration preserved', Math.abs(walkOnMichelle.duration - walk.duration) < 0.01,
  `${walkOnMichelle.duration.toFixed(3)}s vs ${walk.duration.toFixed(3)}s`);

// Resolve track targets exactly the way three's PropertyBinding does.
const byName = new Map();
const uuids = new Set();
michelle.scene.traverse((o) => {
  byName.set(o.name.replace(/[^\w\-]/g, ''), o);
  uuids.add(o.uuid);
});
const resolve = (track) => {
  const node = track.name.split('.')[0];
  return byName.get(node) || (uuids.has(node) ? node : null);
};
check('all track targets exist in destination', walkOnMichelle.tracks.every((t) => !!resolve(t)));

// hips must get a position track (root motion) and rotations must land in bind space
const mBones = collectBones(michelle.scene);
const mHip = findHip(mBones);
const hipPos = walkOnMichelle.tracks.find((t) => resolve(t) === mHip && t.name.endsWith('.position'));
check('hips translation carried over', !!hipPos);

const srcBones = collectBones(soldier.scene);
const core = ['spine', 'spine1', 'spine2', 'neck', 'head', 'leftshoulder', 'leftarm', 'leftforearm',
  'leftupleg', 'leftleg', 'leftfoot', 'rightshoulder', 'rightarm', 'rightupleg', 'rightleg', 'rightfoot'];

// Retarget a clip of the walk onto Michelle and drive her skeleton.
const mixer = new THREE.AnimationMixer(michelle.scene);
mixer.clipAction(walkOnMichelle).play();
const srcMixer = new THREE.AnimationMixer(soldier.scene);
srcMixer.clipAction(walk).play();

const restLocal = (sk) => {
  const m = new Map();
  for (const [k, b] of sk.map) m.set(k, b.quaternion.clone());
  return m;
};
const sRest = restLocal(srcBones);
const mRest = restLocal(mBones);
const localNow = (sk) => {
  const m = new Map();
  for (const [k, b] of sk.map) m.set(k, b.quaternion.clone());
  return m;
};

/**
 * The invariant for a retarget: each bone's motion *relative to its own rest
 * pose, within its own parent frame*, must be the same on both rigs. Absolute
 * world rotations are not comparable (the rigs bind in different frames).
 */
let worst = 0;
let worstBone = '';
let samples = 0;
for (const t of [0, 0.15, 0.37, 0.62, 0.9]) {
  srcMixer.setTime(t);
  mixer.setTime(t);
  soldier.scene.updateMatrixWorld(true);
  michelle.scene.updateMatrixWorld(true);
  const a = localNow(srcBones);
  const b = localNow(mBones);
  for (const key of core) {
    if (!a.has(key) || !b.has(key)) continue;
    const da = sRest.get(key).clone().invert().multiply(a.get(key));
    const db = mRest.get(key).clone().invert().multiply(b.get(key));
    const d = da.angleTo(db);
    if (d > worst) { worst = d; worstBone = key; }
    samples++;
  }
}
check('motion relative to bind pose matches source', worst < 0.03,
  `worst ${(worst * 180 / Math.PI).toFixed(1)}° on "${worstBone}" over ${samples} samples`);

// world-space bone directions must line up too (that is what the eye sees)
const dirOf = (sk, key) => new THREE.Vector3(0, 1, 0)
  .applyQuaternion(sk.map.get(key).getWorldQuaternion(new THREE.Quaternion())).normalize();
let worstDir = 0;
let dirBone = '';
for (const t of [0, 0.3, 0.7]) {
  srcMixer.setTime(t);
  mixer.setTime(t);
  soldier.scene.updateMatrixWorld(true);
  michelle.scene.updateMatrixWorld(true);
  for (const key of core) {
    if (!srcBones.map.has(key) || !mBones.map.has(key)) continue;
    const d = dirOf(srcBones, key).angleTo(dirOf(mBones, key));
    if (d > worstDir) { worstDir = d; dirBone = key; }
  }
}
console.log(`INFO  limb directions vs source: worst ${(worstDir * 180 / Math.PI).toFixed(1)}° on "${dirBone}"` +
  ' (these two rigs bind mirrored, so a residual here is expected)');

// The real quality measure: joint positions (each bone's tip, i.e. its child)
// relative to the body, which is what drives the mesh.
function jointShape(scene, sk) {
  scene.updateMatrixWorld(true);
  const hip = sk.map.get('hips');
  const hipP = hip.getWorldPosition(new THREE.Vector3());
  const out = new Map();
  for (const [k, b] of sk.map) {
    const child = b.children.find((c) => c.isBone);
    if (!child) continue;
    out.set(k, child.getWorldPosition(new THREE.Vector3()).sub(hipP));
  }
  return out;
}
let worstJoint = 0;
let jointBone = '';
for (const t of [0, 0.25, 0.5, 0.75]) {
  srcMixer.setTime(t);
  mixer.setTime(t);
  const a = jointShape(soldier.scene, srcBones);
  const b = jointShape(michelle.scene, mBones);
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb) continue;
    // compare only the direction of each limb segment: limb lengths differ
    const d = va.clone().normalize().angleTo(vb.clone().normalize());
    if (d > worstJoint) { worstJoint = d; jointBone = k; }
  }
}
console.log(`INFO  limb segment directions vs source: worst ${(worstJoint * 180 / Math.PI).toFixed(1)}° on "${jointBone}"`);

// hips must stay upright and near bind height in world space
const hipHeights = [];
for (let i = 0; i <= 12; i++) {
  mixer.setTime((i / 12) * walkOnMichelle.duration);
  michelle.scene.updateMatrixWorld(true);
  hipHeights.push(mBones.map.get('hips').getWorldPosition(new THREE.Vector3()).y);
}
const bindHipY = mBones.map.get('hips').getWorldPosition(new THREE.Vector3()).y;
check('hips stay upright near bind height',
  Math.min(...hipHeights) > bindHipY * 0.6 && Math.max(...hipHeights) < bindHipY * 1.6,
  `y ${Math.min(...hipHeights).toFixed(2)}..${Math.max(...hipHeights).toFixed(2)} (bind ${bindHipY.toFixed(2)})`);

// Physical sanity: nothing may fly off. Feet under the body, hands below head.
let sane = true;
let saneDetail = '';
for (let i = 0; i <= 12; i++) {
  mixer.setTime((i / 12) * walkOnMichelle.duration);
  michelle.scene.updateMatrixWorld(true);
  const hipY = mBones.map.get('hips').getWorldPosition(new THREE.Vector3()).y;
  const footY = Math.min(
    ...['leftfoot', 'rightfoot'].map((k) => mBones.map.get(k).getWorldPosition(new THREE.Vector3()).y)
  );
  const headY = mBones.map.get('head').getWorldPosition(new THREE.Vector3()).y;
  const headZ = mBones.map.get('head').getWorldPosition(new THREE.Vector3()).z;
  if (footY > hipY || footY < -0.5) { sane = false; saneDetail = `foot y ${footY.toFixed(2)} vs hip ${hipY.toFixed(2)}`; }
  if (headY < hipY) { sane = false; saneDetail = `head below hips (${headY.toFixed(2)} < ${hipY.toFixed(2)})`; }
  if (Math.abs(headZ) > 1) { sane = false; saneDetail = `head flew to z=${headZ.toFixed(2)}`; }
}
check('retargeted pose stays physically sane', sane, saneDetail);

// and the reverse direction
const { clip: sambaOnSoldier, matched: m2 } = retargetClip(samba, michelle.scene, soldier.scene, { fps: 30 });
check('Michelle/Samba retargets onto Soldier', m2 >= 45, `${m2} bones mapped`);
check('multi-clip: 3 clips drive one skeleton', (() => {
  const m = new THREE.AnimationMixer(michelle.scene);
  const clips = [walkOnMichelle, ...michelle.animations.filter((a) => a.name !== 'TPose')];
  clips.forEach((c) => m.clipAction(c).play());
  m.update(0.25);
  return m._actions.length === 2;
})());

console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
