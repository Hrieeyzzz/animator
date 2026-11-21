/**
 * Retargeting engine.
 *
 * Mixamo exports come in three shapes:
 *   - "With Skin"     -> skinned mesh + armature + one animation
 *   - "Without Skin"  -> armature + one animation, no mesh
 *   - GLB (re-export) -> mesh + any number of clips in one file
 *
 * An animation authored on one skeleton has to be re-expressed on the user's
 * skeleton. Simply copying local rotations is not enough: two "Mixamo" rigs can
 * bind with different per-bone orientations (one exports the hips rotated 180°
 * about a diagonal axis, another uses the classic -90° X flip), so identical
 * local values describe different poses.
 *
 * What we transfer instead, for every bone:
 *   1. its *direction* (the bone axis) expressed relative to the body,
 *   2. its *twist* around that axis,
 * and we re-apply that motion on top of the destination's own bind pose. That
 * is rig-agnostic: it works for Mixamo → Mixamo, and for Mixamo → any rig whose
 * bones can be matched by name.
 */

import {
  AnimationMixer,
  LoopOnce,
  Matrix4,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';

/** The bones Mixamo animates, in hierarchy order. */
export const MIXAMO_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];

/** Fingers are transferred too when both rigs have them. */
export const FINGER_BONES = [
  'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3',
  'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3',
  'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
  'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3',
  'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3',
  'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3',
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3',
  'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3',
];

export const ALL_MAPPABLE = [...MIXAMO_BONES, ...FINGER_BONES];

const _m1 = new Matrix4();
const _v1 = new Vector3();
const _v2 = new Vector3();
const _q1 = new Quaternion();
const _q2 = new Quaternion();
const BONE_AXIS = new Vector3(0, 1, 0); // three.js bones point along +Y
const identityQ = new Quaternion();



/**
 * "mixamorig:LeftArm" -> "leftarm". Also copes with "Armature|Hips",
 * "mixamorigLeftArm", "LeftArm_01" style exports.
 */
export function normalizeName(name = '') {
  return String(name)
    .replace(/^.*[:|]/, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .replace(/^mixamorig/i, '')
    .replace(/_?\d{2,}$/, '')
    .toLowerCase();
}

/** Every bone in a hierarchy, keyed by normalized name. */
export function collectBones(root) {
  const map = new Map();
  const bones = [];
  root.traverse((o) => {
    if (!o.isBone) return;
    bones.push(o);
    let key = normalizeName(o.name) || 'bone';
    if (map.has(key) && map.get(key) !== o) {
      let i = 1;
      while (map.has(`${key}_${i}`)) i++;
      key = `${key}_${i}`;
    }
    map.set(key, o);
  });
  return { map, bones };
}

/** Hip / root bone of a skeleton, with fallbacks for non-Mixamo rigs. */
export function findHip(skeleton) {
  for (const key of ['hips', 'hip', 'pelvis', 'root']) {
    if (skeleton.map.has(key)) return skeleton.map.get(key);
  }
  return skeleton.bones.find((b) => b.parent && !b.parent.isBone) || skeleton.bones[0] || null;
}

/** 0..1 — how much of a Mixamo skeleton a hierarchy provides. */
export function rigCoverage(root) {
  const { map } = collectBones(root);
  let hits = 0;
  for (const b of MIXAMO_BONES) if (map.has(normalizeName(b))) hits++;
  return hits / MIXAMO_BONES.length;
}

/**
 * Track names are parsed by three's PropertyBinding, where ":" "." "/" "["
 * and "]" split the path — a "mixamorig:Hips" name can never bind. Reduce a
 * bone to a token that survives that parser and still resolves by name.
 */
const _names = new WeakMap();
export function safeNodeName(bone) {
  if (_names.has(bone)) return _names.get(bone);
  let base = bone.name.replace(/[^\w-]/g, '');
  if (!base) base = bone.uuid.replace(/-/g, '');
  _names.set(bone, base);
  return base;
}

/** Depth in the scene graph — used to write bone rotations parent-first. */
function depthOf(obj) {
  let d = 0;
  let p = obj;
  while (p) {
    p = p.parent;
    d++;
  }
  return d;
}

/**
 * Pair source bones with destination bones by normalized name. Falls back to
 * positional matching for rigs whose bones lost their names.
 */
export function buildBonePairs(srcRoot, dstRoot) {
  const src = collectBones(srcRoot);
  const dst = collectBones(dstRoot);

  const pairs = [];
  for (const [key, srcBone] of src.map) {
    const dstBone = dst.map.get(key);
    if (dstBone && dstBone !== srcBone) pairs.push({ key, srcBone, dstBone });
  }

  if (pairs.length < Math.min(6, src.bones.length)) {
    const wanted = new Set(ALL_MAPPABLE.map(normalizeName));
    const a = src.bones.filter((b) => wanted.has(normalizeName(b.name)));
    const b = dst.bones.filter((x) => wanted.has(normalizeName(x.name)));
    if (a.length && a.length === b.length) {
      pairs.length = 0;
      a.forEach((srcBone, i) =>
        pairs.push({ key: normalizeName(srcBone.name), srcBone, dstBone: b[i] })
      );
    }
  }

  pairs.sort((x, y) => depthOf(x.srcBone) - depthOf(y.srcBone));
  return { pairs, src, dst };
}

/**
 * Re-target `clip` (authored on `srcRoot`) onto `dstRoot`.
 *
 * @param {import('three').AnimationClip} clip
 * @param {import('three').Object3D} srcRoot
 * @param {import('three').Object3D} dstRoot
 * @param {object} [opts]
 * @param {number} [opts.fps=30]              bake sample rate
 * @param {boolean} [opts.scaleRootMotion=true] scale hip travel by height ratio
 * @param {boolean} [opts.rootMotion=true]    keep hip translation at all
 * @param {number} [opts.speed=1]             time stretch
 * @param {number} [opts.timeOffset=0]        start `speed` seconds into the clip
 * @returns {{clip: import('three').AnimationClip, matched: number, total: number}}
 */
export function retargetClip(clip, srcRoot, dstRoot, opts = {}) {
  const {
    fps = 30,
    scaleRootMotion = true,
    rootMotion = true,
    speed = 1,
    timeOffset = 0,
  } = opts;

  const { pairs, src, dst } = buildBonePairs(srcRoot, dstRoot);
  if (pairs.length === 0) {
    throw new Error(
      'No matching bones. Both the model and the animation need a Mixamo-style skeleton.'
    );
  }

  const srcHip = findHip(src);
  const dstHip = findHip(dst);

  // Which way does each character face at rest? Root motion has to be rotated
  // into the destination's facing or the character moonwalks across the floor.
  srcRoot.updateWorldMatrix(true, true);
  dstRoot.updateWorldMatrix(true, true);
  const facingYaw = (bone) => {
    if (!bone) return 0;
    const q = bone.getWorldQuaternion(new Quaternion());
    // A character's hips face along its local +Z (three.js convention).
    const fwd = new Vector3(0, 0, 1).applyQuaternion(q);
    return Math.atan2(fwd.x, fwd.z);
  };
  const yawDelta = facingYaw(dstHip) - facingYaw(srcHip);
  const rootFrameQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yawDelta);

  // ---- bind (rest) state of both rigs ----
  srcRoot.updateWorldMatrix(true, true);
  dstRoot.updateWorldMatrix(true, true);

  const srcHipBindP = srcHip ? srcHip.getWorldPosition(new Vector3()) : new Vector3();
  const dstHipBindP = dstHip ? dstHip.getWorldPosition(new Vector3()) : new Vector3();
  const dstHipParent = dstHip ? dstHip.parent : null;

  // ---- the transfer itself ----
  //
  // For each mapped bone, take the source's local motion *delta* — how far its
  // local rotation moved away from its own bind rotation:
  //
  //     Q_src = L_now · L_bind⁻¹            (a rotation in the bone's own frame)
  //
  // and re-express that delta in the destination bone's frame through the
  // rotation that takes the source's bind frame to the destination's:
  //
  //     P     = L_bind_dst · L_bind_src⁻¹
  //     Q_dst = P · Q_src · P⁻¹
  //     L_dst = Q_dst · L_bind_dst
  //
  // This is a change of basis, so a knee that bends "forwards" on the source
  // bends forwards on the destination even when the rigs bind with flipped or
  // rotated local axes — which Mixamo rigs routinely do (90° or 180° per bone,
  // T-pose vs A-pose). No heuristics about which way a bone should point.
  const meta = [];
  for (const p of pairs) {
    const srcBind = p.srcBone.quaternion.clone();
    const dstBind = p.dstBone.quaternion.clone();
    const P = dstBind.clone().multiply(srcBind.clone().invert());
    meta.push({
      ...p,
      srcBind,
      dstBind,
      srcBindInv: srcBind.clone().invert(),
      P,
      PInv: P.clone().invert(),
      isHip: p.srcBone === srcHip,
      hasKids: p.srcBone.children.some((c) => c.isBone) && p.dstBone.children.some((c) => c.isBone),
    });
  }

  // ---- sampling ----
  const clipDur = Math.max(clip.duration, 1e-3);
  const stretch = 1 / Math.max(speed, 0.05);
  const duration = Math.max(clipDur * stretch, 1 / fps);
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const times = new Float32Array(frames);
  for (let i = 0; i < frames; i++) times[i] = (i / (frames - 1)) * duration;

  const quatData = new Map();
  const posData = new Map();
  for (const m of meta) {
    quatData.set(m, new Float32Array(frames * 4));
    posData.set(m, m.isHip && rootMotion ? new Float32Array(frames * 3) : null);
  }

  // Character height ratio keeps root motion proportional to the body.
  let ratio = 1;
  if (scaleRootMotion && srcHip && dstHip) {
    const a = Math.abs(srcHipBindP.y);
    const b = Math.abs(dstHipBindP.y);
    if (a > 1e-5 && b > 1e-5) ratio = b / a;
  }

  const mixer = new AnimationMixer(srcRoot);
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  const localQ = new Quaternion();
  const deltaQ = new Quaternion();

  for (let f = 0; f < frames; f++) {
    const t = Math.min(Math.max(timeOffset + times[f] * speed, 0), clipDur);
    mixer.setTime(t);
    srcRoot.updateMatrixWorld(true);

    for (const m of meta) {
      // Source delta, in the bone's own local frame.
      deltaQ.copy(m.srcBone.quaternion).multiply(m.srcBindInv);
      // Change of basis into the destination's local frame, then that rig's bind.
      localQ.copy(m.P).multiply(deltaQ).multiply(m.PInv).multiply(m.dstBind);

      const q = quatData.get(m);
      q[f * 4] = localQ.x;
      q[f * 4 + 1] = localQ.y;
      q[f * 4 + 2] = localQ.z;
      q[f * 4 + 3] = localQ.w;

      const pos = posData.get(m);
      if (pos) {
        // Root travel goes through world space: the offset from the source's
        // bind position, scaled for character size, re-based on the
        // destination's bind position, then into the hip's parent space (the
        // space a .position track writes).
        srcHip.getWorldPosition(_v1);
        _v1.sub(srcHipBindP).applyQuaternion(rootFrameQ).multiplyScalar(ratio).add(dstHipBindP);
        if (dstHipParent) {
          dstHipParent.updateWorldMatrix(true, false);
          _v1.applyMatrix4(_m1.copy(dstHipParent.matrixWorld).invert());
        }
        pos[f * 3] = _v1.x;
        pos[f * 3 + 1] = _v1.y;
        pos[f * 3 + 2] = _v1.z;
      }
    }
  }

  mixer.stopAllAction();
  mixer.uncacheClip(clip);

  const tracks = [];
  for (const m of meta) {
    tracks.push(
      new QuaternionKeyframeTrack(`${safeNodeName(m.dstBone)}.quaternion`, times, quatData.get(m))
    );
    const pos = posData.get(m);
    if (pos) tracks.push(new VectorKeyframeTrack(`${safeNodeName(m.dstBone)}.position`, times, pos));
  }

  const out = new clip.constructor(clip.name, duration, tracks);
  out.blendMode = clip.blendMode;
  out.userData = {
    retargeted: true,
    matchedBones: meta.length,
    sourceBones: src.bones.length,
    sourceDuration: clip.duration,
    speed,
  };
  return { clip: out, matched: meta.length, total: src.bones.length };
}

/** Does this clip already drive `root` (i.e. it was authored on this model)? */
export function clipsUseRoot(clip, root) {
  const names = new Set();
  const norm = new Set();
  root.traverse((o) => {
    names.add(o.name);
    norm.add(normalizeName(o.name));
    names.add(safeNodeName(o));
  });
  let matched = 0;
  for (const track of clip.tracks) {
    const target = track.name.split('.')[0];
    if (names.has(target) || norm.has(normalizeName(target))) matched++;
  }
  return clip.tracks.length > 0 && matched / clip.tracks.length > 0.9;
}

/** Tidy a Mixamo clip name ("mixamorig|Walking (2)") for display. */
export function plainClipName(clip, fallback = 'Clip') {
  const name = (clip.name || '')
    .replace(/^.*\|/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/mixamorig[:_ ]?/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name || fallback;
}
