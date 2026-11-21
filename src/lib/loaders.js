/**
 * Model / animation loading.
 *
 * Everything runs in the browser: files never leave the machine. The FBX
 * loader is imported lazily because it is a large module and most users only
 * touch the animation files.
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const SUPPORTED_MODEL_EXT = ['glb', 'gltf', 'fbx', 'obj'];
export const SUPPORTED_ANIM_EXT = ['fbx', 'glb', 'gltf', 'bvh'];

export function extOf(name = '') {
  return name.split('.').pop().toLowerCase();
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / 1024 ** i;
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

let fbxModule = null;
async function fbxLoader() {
  if (!fbxModule) {
    const mod = await import('three/addons/loaders/FBXLoader.js');
    fbxModule = new mod.FBXLoader();
  }
  return fbxModule;
}

let objModule = null;
async function objLoader() {
  if (!objModule) {
    const mod = await import('three/addons/loaders/OBJLoader.js');
    objModule = new mod.OBJLoader();
  }
  return objModule;
}

/**
 * Load one file into a scene graph + clips.
 * @param {File} file
 * @param {(p:number)=>void} [onProgress] 0..1
 */
export async function loadFile(file, onProgress) {
  const ext = extOf(file.name);

  if (ext === 'glb' || ext === 'gltf' || ext === 'obj') {
    const buffer = await readWithProgress(file, onProgress);
    if (ext === 'obj') {
      const loader = await objLoader();
      const object = loader.parse(new TextDecoder().decode(buffer));
      return { object, animations: [] };
    }
    const gltf = await gltfLoader.parseAsync(buffer, '');
    return { object: gltf.scene || gltf.scenes[0], animations: gltf.animations || [] };
  }

  if (ext === 'fbx') {
    const buffer = await readWithProgress(file, onProgress);
    const loader = await fbxLoader();
    const object = loader.parse(buffer, '');
    const animations = object.animations || [];
    // FBX clips are left attached to the object; callers decide what to keep.
    object.animations = [];
    return { object, animations };
  }

  if (ext === 'bvh') {
    // BVH is a mocap format: it brings its own skeleton, so it can only be a
    // *source* of animation, never a model.
    const { BVHLoader } = await import('three/addons/loaders/BVHLoader.js');
    const text = await file.text();
    onProgress?.(1);
    const result = new BVHLoader().parse(text);
    return { object: result.skeleton.bones[0], animations: [result.clip], isBVH: true };
  }

  throw new Error(`Unsupported file type ".${ext}".`);
}

function readWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    reader.onload = () => {
      onProgress?.(1);
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Recursively free GPU resources held by a scene graph. */
export function disposeObject(root) {
  root?.traverse?.((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose?.();
    }
  });
}
