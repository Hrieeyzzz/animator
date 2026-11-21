/**
 * Tiny observable store. One object holds the whole session so that the
 * preview and the panels always agree, and so a session can be saved/restored.
 */

let idSeq = 1;
export const nextId = (prefix = 'id') => `${prefix}_${idSeq++}`;

const listeners = new Set();

export const state = {
  /** @type {null | {name:string, root:import('three').Object3D, animations:import('three').AnimationClip[], size:number, boneCount:number, coverage:number, id:string}} */
  model: null,

  /** @type {Array<{id:string,name:string,clips:import('three').AnimationClip[],sourceRoot:import('three').Object3D,size:number,ext:string}>} */
  library: [],

  /** @type {Array<{id:string,sourceFolder:string,clipIndex:number,name:string,loop:number,trimStart:number,trimEnd:number,rootMotion:boolean,locked:boolean}>} */
  sequence: [],

  /** Preview state. */
  preview: {
    playing: false,
    speed: 1,
    loopSequence: true,
    showSkeleton: false,
    showGrid: true,
    wireframe: false,
    currentIndex: -1,
    time: 0,
  },

  ui: {
    tab: 'sequence', // 'sequence' | 'library'
    busy: null, // {label, progress}
    toast: null,
    exportOpen: false,
    search: '',
    category: 'All',
  },
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn(state);
}

/** Ask for a re-render after mutating state. */
export const update = (mutator) => {
  mutator?.(state);
  emit();
};

/** Find a library entry by id. */
export const folderById = (id) => state.library.find((f) => f.id === id) || null;

/** Find the clip a sequence row points at. */
export function clipForItem(item) {
  const folder = folderById(item.sourceFolder);
  if (!folder) return null;
  return folder.clips[item.clipIndex] || null;
}

/** The source armature a sequence row's clip was authored on. */
export function sourceRootForItem(item) {
  const folder = folderById(item.sourceFolder);
  return folder ? folder.sourceRoot : null;
}

let toastTimer = null;
export function toast(message, kind = 'info', ms = 3600) {
  state.ui.toast = { message, kind, at: Date.now() };
  emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (state.ui.toast && Date.now() - state.ui.toast.at >= ms - 60) {
      state.ui.toast = null;
      emit();
    }
  }, ms);
}

export function setBusy(label, progress = null) {
  state.ui.busy = label ? { label, progress } : null;
  emit();
}
