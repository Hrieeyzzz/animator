/**
 * The 3D viewport: renderer, camera, lighting, the model, and playback of the
 * assembled sequence.
 *
 * Playback works on the model the user uploaded. Each sequence row is
 * retargeted once (when the row or the model changes) and the results are kept
 * in a cache, so scrubbing and re-ordering stay instant.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { retargetClip, collectBones } from './retarget.js';
import { clipForItem, sourceRootForItem, folderById, state, emit } from '../state/store.js';

export class Viewport {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.Fog(0x0b0d12, 12, 34);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    this.camera.position.set(2.4, 2.1, 4.2);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 1000;
    this.controls.maxPolarAngle = Math.PI * 0.96;
    this.controls.target.set(0, 1, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.42;

    // Lights: a warm key, a cool rim, and a soft fill so the silhouette reads.
    const key = new THREE.DirectionalLight(0xfff2e0, 2.4);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    this.keyLight = key;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x8fb6ff, 1.5);
    rim.position.set(-5, 4, -6);
    this.scene.add(rim);

    this.scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x20242e, 1.1));

    // Floor + grid
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.95, metalness: 0 })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.grid = new THREE.GridHelper(24, 48, 0x2a3242, 0x1a1f29);
    this.grid.position.y = 0.001;
    this.scene.add(this.grid);

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.mixer = null;
    this.activeAction = null;
    this.clipCache = new Map();
    this.clock = new THREE.Clock();
    this.onTimeUpdate = null;
    this.currentItemId = null;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    this._onFrame = this.frame.bind(this);
    this.renderer.setAnimationLoop(this._onFrame);
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Replace the displayed model and rebuild the sequence cache. */
  setModel(model) {
    this.clearModel();
    if (!model) return;
    this.model = model;
    this.modelGroup.add(model.root);
    this.model.root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          m.shadowSide = THREE.FrontSide;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    });
    this.frameModel();
    this.mixer = new THREE.AnimationMixer(model.root);
    this.mixer.addEventListener('finished', () => this.handleFinished());
    this.buildSkeletonHelper();
    this.invalidateCache();
  }

  clearModel() {
    if (this.mixer) this.mixer.stopAllAction();
    this.mixer = null;
    this.activeAction = null;
    this.model = null;
    this.modelGroup.clear();
    this.clearSkeletonHelper();
  }

  frameModel() {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model.root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const dist = Math.max(radius * 2.6, 1.4);

    // Mixamo FBX characters are often measured in centimeters, while GLB
    // models are commonly in meters. Scale orbit limits to the actual model.
    this.controls.minDistance = Math.max(radius * 0.05, 0.001);
    this.controls.maxDistance = Math.max(dist * 30, this.controls.minDistance * 100);
    this.controls.target.set(center.x, center.y, center.z);
    this.camera.position.set(
      center.x + dist * 0.55,
      center.y + size.y * 0.22,
      center.z + dist
    );
    this.camera.near = Math.max(dist / 200, 0.01);
    this.camera.far = this.controls.maxDistance * 3;
    this.camera.updateProjectionMatrix();
    this.controls.update();

    this.floor.position.y = box.min.y - 0.002;
    this.grid.position.y = box.min.y;
    this.keyLight.target.position.copy(center);
    this.keyLight.target.updateMatrixWorld();
    this.scene.add(this.keyLight.target);
    this.scene.fog.near = dist * 2;
    this.scene.fog.far = dist * 8;
  }

  zoom(factor) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    if (offset.lengthSq() === 0) offset.set(0, 0, 1);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
    this.controls.update();
  }

  buildSkeletonHelper() {
    this.clearSkeletonHelper();
    if (!this.model) return;
    this.skeletonHelper = new THREE.SkeletonHelper(this.model.root);
    this.skeletonHelper.material.linewidth = 1;
    this.skeletonHelper.material.depthTest = false;
    this.skeletonHelper.material.transparent = true;
    this.skeletonHelper.material.opacity = 0.9;
    this.skeletonHelper.visible = !!(state?.preview?.showSkeleton ?? false);
    this.scene.add(this.skeletonHelper);
  }

  clearSkeletonHelper() {
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper.geometry?.dispose();
      this.skeletonHelper.material?.dispose();
      this.skeletonHelper = null;
    }
  }

  setSkeletonVisible(v) {
    if (this.skeletonHelper) this.skeletonHelper.visible = v;
  }

  setGridVisible(v) {
    this.grid.visible = v;
    this.floor.visible = v;
  }

  setWireframe(v) {
    this.model?.root.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if ('wireframe' in m) m.wireframe = v;
    });
  }

  /** Retarget (and cache) one sequence row for the current model. */
  prepareItem(item) {
    const clip = clipForItem(item);
    if (!clip) return null;
    const key = `${this.model?.id}|${item.id}|${item.trimStart}|${item.trimEnd}|${item.rootMotion}`;
    if (this.clipCache.has(key)) return this.clipCache.get(key);

    let result;
    if (folderById(item.sourceFolder)?.native) {
      let trimmed = trimClip(clip, item.trimStart, item.trimEnd);
      if (!item.rootMotion) {
        trimmed = trimmed.clone();
        trimmed.tracks = trimmed.tracks.filter(t => !/hips\.position$/i.test(t.name));
      }
      result = { clip: trimmed, matched: countBones(this.model.root), total: countBones(this.model.root) };
    } else {
      const srcRoot = sourceRootForItem(item);
      const sliced = trimClip(clip, item.trimStart, item.trimEnd);
      result = retargetClip(sliced, srcRoot, this.model.root, {
        fps: 30,
        rootMotion: item.rootMotion,
      });
    }
    this.clipCache.set(key, result);
    return result;
  }

  /** Drop cached clips (after an edit that invalidates them). */
  invalidateCache() {
    this.clipCache.clear();
    this.currentItemId = null;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.activeAction = null;
    }
  }

  async playSequence(sequence, opts = {}) {
    if (!this.mixer || !this.model || sequence.length === 0) return;
    const index = opts.index ?? 0;
    await this.playIndex(sequence, index);
  }

  async playIndex(sequence, index) {
    if (!this.mixer || !this.model) return;
    if (!sequence.length) return;
    const i = ((index % sequence.length) + sequence.length) % sequence.length;
    const item = sequence[i];
    state.preview.currentIndex = i;

    // Restore the model's original pose before using it as a retarget bind pose.
    this.mixer.stopAllAction();
    const prepared = this.prepareItem(item);
    if (!prepared) return;

    this.mixer.uncacheRoot(this.model.root);
    this.mixer = new THREE.AnimationMixer(this.model.root);
    this.mixer.addEventListener('finished', () => this.handleFinished());

    const action = this.mixer.clipAction(prepared.clip);
    action.reset();
    action.setLoop(item.loop ? THREE.LoopRepeat : THREE.LoopOnce, item.loop ? Infinity : 1);
    action.clampWhenFinished = !item.loop;
    action.play();
    this.activeAction = action;
    this.currentItemId = item.id;
    state.preview.time = 0;
    state.preview.playing = true;
    this._startedAt = performance.now();
  }

  handleFinished() {
    const seq = state.sequence;
    const i = state.preview.currentIndex;
    if (i < 0) return;
    const next = i + 1;
    if (next < seq.length) {
      this.playIndex(seq, next);
    } else if (state.preview.loopSequence && seq.length) {
      this.playIndex(seq, 0);
    } else {
      state.preview.playing = false;
    }
    emit();
  }

  play() {
    state.preview.playing = true;
  }

  pause() {
    state.preview.playing = false;
  }

  setSpeed(v) {
    state.preview.speed = v;
    if (this.activeAction) {
      // Applied through the mixer's timeScale so playback rate is uniform.
      this.mixer.timeScale = v;
    }
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.controls.update();

    if (this.mixer && state.preview.playing) {
      this.mixer.timeScale = state.preview.speed;
      this.mixer.update(dt);
      this.onTimeUpdate?.();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function countBones(root) {
  return collectBones(root).bones.length;
}

/** Slice a clip to a time range (0..1 fractions). */
export function trimClip(clip, startFrac = 0, endFrac = 1) {
  const d = clip.duration;
  const s = Math.max(0, Math.min(startFrac, 0.999)) * d;
  const e = Math.min(1, Math.max(endFrac, 0.001)) * d;
  if (s <= 0.0001 && e >= 0.9999) return clip;
  const clone = clip.clone();
  clone.trim(s, e > s ? e : s + 0.001);
  clone.name = clip.name;
  return clone;
}
