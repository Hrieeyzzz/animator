import './styles.css';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Viewport } from './lib/viewport.js';
import { loadFile, formatBytes, disposeObject } from './lib/loaders.js';
import { collectBones, rigCoverage, safeNodeName, plainClipName } from './lib/retarget.js';
import { state, update, subscribe, nextId, toast, clipForItem } from './state/store.js';
import { icon } from './ui/icons.js';

const app = document.querySelector('#app');
app.innerHTML = `<div class="app">
<header class="topbar"><div class="brand"><div class="brand-mark">✦</div><div>motion studio<small>MIXAMO ANIMATOR</small></div></div><span class="pill top-note">A little movement goes a long way</span><div class="spacer"></div><a class="btn ghost mixamo-link" href="https://www.mixamo.com/#/" target="_blank" rel="noopener noreferrer">Open Mixamo ↗</a><button class="btn ghost" id="help">${icon('help')} How it works</button><button class="btn primary" id="export">${icon('download')} Export GLB</button></header>
<aside class="sidebar"><div class="section"><div class="section-title"><span>01 / Your character</span><span class="count">MODEL</span></div><div id="model-panel"></div></div><div class="tabs"><button class="tab active" data-tab="sequence">Animation list <span class="badge" id="seq-count">0</span></button><button class="tab" data-tab="library">Imported files <span class="badge" id="lib-count">0</span></button></div><div id="list-panel" class="scroll"></div><div class="section"><button class="btn primary" id="browse-mixamo" style="width:100%;margin-bottom:8px">${icon('wand')} Browse Mixamo</button><button class="btn" id="import-animations" style="width:100%">${icon('plus')} Import animations</button><p class="hint" style="margin:9px 0 0">Download animations from <a href="https://www.mixamo.com/#/" target="_blank" rel="noopener noreferrer">Mixamo ↗</a>, then import the FBX files here.</p></div></aside>
<main class="stage" id="stage"><canvas id="canvas"></canvas><div class="stage-top"><div class="float-panel"><button class="icon-btn" id="frame" title="Frame character">${icon('camera')}</button><button class="icon-btn" id="zoom-in" title="Zoom in" aria-label="Zoom in">+</button><button class="icon-btn" id="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><button class="icon-btn on" id="grid" title="Toggle grid">${icon('grid')}</button><button class="icon-btn" id="skeleton" title="Toggle skeleton">${icon('skeleton')}</button><button class="icon-btn" id="wireframe" title="Toggle wireframe">${icon('wireframe')}</button></div><div class="now-playing" id="now">● &nbsp; READY TO CREATE</div></div><div id="stage-empty" class="stage-empty"><div class="stage-emblem">✦</div><div class="stage-eyebrow">YOUR CREATIVE SPACE</div><h1>Bring your character<br><em>to life.</em></h1><p>One model. All your favorite moves.<br>Let's make something move.</p><button class="btn primary" id="stage-upload">${icon('upload')} Upload a character</button><span>GLB or FBX · Mixamo-rigged</span></div><div class="transport"><button class="play-btn" id="play" title="Play or pause">${icon('play')}</button><button class="icon-btn" id="previous" title="Previous animation">◀</button><input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Scrub animation"><span class="time" id="time">0:00 / 0:00</span><button class="icon-btn" id="next" title="Next animation">▶</button><select class="speed" id="speed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div></main>
<aside class="inspector"><div id="inspector"></div></aside><footer class="statusbar"><span class="dot"></span><span>LOCAL WORKSPACE</span><span>Files stay on your device</span><span style="margin-left:auto">MIXAMO → GLB</span></footer></div><input id="model-input" type="file" accept=".glb,.gltf,.fbx" hidden><input id="anim-input" type="file" accept=".fbx,.glb,.gltf" multiple hidden><div id="modal-root"></div><div id="toast-root"></div>`;
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected = null;
let viewport;
try { viewport = new Viewport($('#canvas'), $('#stage')); } catch (e) { toast('3D preview unavailable: ' + e.message, 'err', 9000); }
const openModel = () => $('#model-input').click();
$('#stage-upload').onclick = openModel;
$('#import-animations').onclick = () => $('#anim-input').click();
$('#browse-mixamo').onclick = openMixamoBrowser;
$('#model-input').onchange = async e => { const file = e.target.files[0]; e.target.value = ''; if (file) await importModel(file); };
$('#anim-input').onchange = async e => { const files = [...e.target.files]; e.target.value = ''; await importAnimations(files); };

async function importModel(file) {
  try {
    toast(`Loading ${file.name}…`);
    const {object, animations} = await loadFile(file);
    if (!object) throw new Error('No scene found in file.');
    const bones = collectBones(object).bones;
    if (!bones.length) { disposeObject(object); showRigHelp(); return; }
    // Three.js property binding reserves punctuation in node names.
    for (const bone of bones) bone.name = safeNodeName(bone);
    viewport?.clearModel();
    if (state.model) disposeObject(state.model.root);
    state.model = { id: nextId('model'), name: file.name, root: object, size: file.size, boneCount: bones.length, coverage: rigCoverage(object) };
    state.library = []; state.sequence = []; selected = null;
    state.preview.currentIndex = -1; state.preview.playing = false;
    viewport?.setModel(state.model);
    if (animations.length) addLibrary(file, object, animations, true);
    update();
    toast(`Character loaded · ${bones.length} bones`, 'ok');
  } catch (err) { console.error(err); toast(`Couldn't load model: ${err.message}`, 'err', 8000); }
}
function addLibrary(file, root, clips, native = false) {
  const folder = { id: nextId('file'), name: file.name, sourceRoot: root, clips, size: file.size, native };
  state.library.push(folder);
  clips.forEach((clip, i) => addItem(folder, i));
}
function addItem(folder, i) {
  const clip = folder.clips[i];
  const name = plainClipName(clip, folder.name.replace(/\.[^.]+$/, ''));
  state.sequence.push({id:nextId('clip'), sourceFolder:folder.id, clipIndex:i, name: /^(mixamo\.com|animation|take 001)$/i.test(name) ? folder.name.replace(/\.[^.]+$/, '') : name, trimStart:0, trimEnd:1, rootMotion:true, loop:false});
  selected = state.sequence.at(-1).id;
}
async function importAnimations(files) {
  if (!state.model) { toast('Upload your character first.', 'err'); return; }
  let count = 0;
  for (const file of files) {
    try {
      const {object, animations} = await loadFile(file);
      if (!animations.length) throw new Error('No animation clips found in this file.');
      const sourceBones = collectBones(object).bones;
      if (!sourceBones.length) throw new Error('No animation skeleton found. Use Mixamo FBX without skin.');
      for (const bone of sourceBones) bone.name = safeNodeName(bone);
      addLibrary(file, object, animations); count += animations.length;
    } catch (err) { console.error(err); toast(`${file.name}: ${err.message}`, 'err', 8000); }
  }
  state.ui.tab = 'sequence'; update();
  if (count) toast(`Added ${count} animation${count === 1 ? '' : 's'}`, 'ok');
  return count;
}
function render() {
  const m = state.model, seq = state.sequence;
  $('#model-panel').innerHTML = m ? `<div class="model-card"><div class="model-icon">◇</div><div style="flex:1;min-width:0"><div class="name">${esc(m.name)}</div><div class="meta">${m.boneCount} bones · ${formatBytes(m.size)}</div></div><button class="icon-btn" id="replace-model" title="Replace character">${icon('upload')}</button></div><div class="rig-line"><span class="rig-dot"></span> ${Math.round(m.coverage*100)}% Mixamo bone match</div>` : `<div class="dropzone" id="drop-model" tabindex="0"><div class="upload-symbol">${icon('upload')}</div><div class="big">Drop your character here</div><div class="sub">or <strong>browse files</strong> · GLB, FBX</div></div><div class="hint" style="margin-top:10px">Need to rig a character? <a href="https://www.mixamo.com/#/" target="_blank" rel="noopener noreferrer">Auto-rig on Mixamo ↗</a></div>`;
  $('#replace-model')?.addEventListener('click', openModel);
  const dz = $('#drop-model');
  if (dz) { dz.onclick = openModel; dz.onkeydown = e => { if(e.key==='Enter' || e.key===' ') openModel(); }; dz.ondragover = e => {e.preventDefault(); dz.classList.add('over');}; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => {e.preventDefault(); dz.classList.remove('over'); if(e.dataTransfer.files[0]) importModel(e.dataTransfer.files[0]);}; }
  $('#stage-empty').style.display = m ? 'none' : 'flex';
  $('#seq-count').textContent = seq.length; $('#lib-count').textContent = state.library.length;
  document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === state.ui.tab));
  const panel = $('#list-panel');
  if (state.ui.tab === 'sequence') {
    panel.innerHTML = `<div class="list-heading"><div><div class="section-title" style="margin:0">02 / Your animations</div><div class="hint" style="margin-top:4px">Select a clip to preview or edit</div></div><span class="count-label">${seq.length} CLIPS</span></div>` + (seq.length ? `<div class="seq-list">${seq.map((item,i)=> { const clip=clipForItem(item); return `<div class="seq-item ${item.id===selected?'selected':''} ${state.preview.currentIndex===i?'playing':''}" data-select="${item.id}"><div class="seq-index">${String(i+1).padStart(2,'0')}</div><div><div class="seq-name">${esc(item.name)}</div><div class="seq-sub"><span>${(clip?.duration||0).toFixed(2)} SEC</span><span class="chip ${item.loop?'loop':'once'}">${item.loop?'LOOP':'ONCE'}</span></div></div><div class="seq-actions"><button class="icon-btn" data-action="up" data-id="${item.id}" title="Move up">${icon('up')}</button><button class="icon-btn" data-action="down" data-id="${item.id}" title="Move down">${icon('down')}</button><button class="icon-btn" data-action="delete" data-id="${item.id}" title="Remove">${icon('trash')}</button></div></div>`; }).join('')}</div>` : `<div class="empty empty-list"><span class="empty-graphic">♫</span><b>No animations yet</b><p>Your moves will appear here.<br>Import your first Mixamo animation to begin.</p><button class="btn tiny" id="empty-import">${icon('plus')} Import animations</button></div>`);
    $('#empty-import')?.addEventListener('click', () => $('#anim-input').click());
  } else {
    panel.innerHTML = `<div class="list-heading"><div><div class="section-title" style="margin:0">Imported files</div><div class="hint" style="margin-top:4px">Add clips to your animation list</div></div></div>` + (state.library.length ? state.library.map(f => `<div class="folder"><div class="folder-head"><span>▸</span><span class="fname">${esc(f.name)}</span><span class="fmeta">${f.clips.length} clips</span></div>${f.clips.map((c,i)=>`<div class="clip-row"><span class="cname">${esc(plainClipName(c, f.name))}</span><span class="dur">${c.duration.toFixed(2)}s</span><button class="icon-btn" data-add="${f.id}" data-index="${i}" title="Add to list">${icon('plus')}</button></div>`).join('')}</div>`).join('') : '<div class="empty">No files imported yet.</div>');
  }
  const item = seq.find(x=>x.id===selected), clip = item && clipForItem(item);
  $('#inspector').innerHTML = `<div class="inspector-heading"><span>DETAILS</span><span>✧</span></div>` + (item ? `<div class="section"><div class="section-title">Selected animation</div><div class="selected-name">${esc(item.name)}</div><div class="hint">${esc(state.library.find(f=>f.id===item.sourceFolder)?.name)}</div></div><div class="section"><div class="section-title">Playback settings</div><div class="field"><label class="lbl" for="clip-name">Animation name</label><input type="text" id="clip-name" value="${esc(item.name)}"></div><label class="check"><input type="checkbox" id="clip-loop" ${item.loop?'checked':''}> Loop this clip</label><p class="hint">A looping clip plays until you select another.</p><label class="check"><input type="checkbox" id="root-motion" ${item.rootMotion?'checked':''}> Include root motion</label><p class="hint">Keep the original character movement across the floor.</p></div><div class="section"><div class="section-title">Clip information</div><div class="kv"><span>Duration</span><span>${(clip?.duration||0).toFixed(2)} sec</span></div><div class="kv"><span>Tracks</span><span>${clip?.tracks.length||0}</span></div></div><div class="section"><button class="btn" id="preview-selected" style="width:100%">${icon('play')} Preview animation</button></div>` : `<div class="inspector-empty"><div class="empty-graphic">✧</div><b>Nothing selected</b><p>Select an animation to see its details and playback settings.</p></div>`)+`<div class="inspector-tip"><span>✦</span><div><b>PRO TIP</b><p>For best results, use animations downloaded for the same character from Mixamo.</p></div></div>`;
  if(item) {
    $('#clip-name').onchange = e => {item.name=e.target.value.trim()||'Animation';update();};
    $('#clip-loop').onchange = e => {item.loop=e.target.checked; update();};
    $('#root-motion').onchange = e => {item.rootMotion=e.target.checked; viewport?.invalidateCache(); state.preview.playing=false; update();};
    $('#preview-selected').onclick = () => playIndex(seq.indexOf(item));
  }
  $('#play').innerHTML = icon(state.preview.playing ? 'pause' : 'play');
  const current = seq[state.preview.currentIndex];
  $('#now').innerHTML = current ? `● &nbsp; <span>PREVIEWING &nbsp; <b>${esc(current.name)}</b></span>` : '● &nbsp; READY TO CREATE';
  $('#export').disabled = !m || !seq.length;
  const tr = state.ui.toast; $('#toast-root').innerHTML = tr ? `<div class="toast ${tr.kind==='err'?'err':tr.kind==='ok'?'ok':''}">${esc(tr.message)}</div>` : '';
}
subscribe(render);
document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{state.ui.tab=el.dataset.tab;update();});
$('#list-panel').onclick = e => {
  const add=e.target.closest('[data-add]'); if(add){const f=state.library.find(x=>x.id===add.dataset.add);addItem(f,Number(add.dataset.index));update();return;}
  const action=e.target.closest('[data-action]'); if(action){e.stopPropagation(); const i=state.sequence.findIndex(x=>x.id===action.dataset.id); if(i<0)return; if(action.dataset.action==='delete'){state.sequence.splice(i,1);if(selected===action.dataset.id)selected=state.sequence[0]?.id||null;} else {const j=i+(action.dataset.action==='up'?-1:1);if(j>=0&&j<state.sequence.length)[state.sequence[i],state.sequence[j]]=[state.sequence[j],state.sequence[i]];} viewport?.invalidateCache();state.preview.playing=false;state.preview.currentIndex=-1;update();return;}
  const row=e.target.closest('[data-select]');if(row){selected=row.dataset.select;update();}
};
async function playIndex(i) { if(!viewport || !state.model || !state.sequence.length)return; try { await viewport.playIndex(state.sequence, i); selected=state.sequence[state.preview.currentIndex]?.id; update(); } catch(e){console.error(e);state.preview.playing=false;toast('Could not play: '+e.message,'err',8000);} }
$('#play').onclick=()=>{if(!state.model||!state.sequence.length){toast('Upload a character and add animations first.');return;}if(state.preview.playing){viewport.pause();update();}else if(viewport.activeAction){viewport.play();update();}else playIndex(Math.max(0,state.sequence.findIndex(x=>x.id===selected)));};
$('#previous').onclick=()=>playIndex(Math.max(0,state.preview.currentIndex-1));
$('#next').onclick=()=>playIndex(Math.min(state.sequence.length-1,state.preview.currentIndex+1));
$('#speed').onchange=e=>viewport?.setSpeed(Number(e.target.value));
$('#scrub').oninput=e=>{if(!viewport?.activeAction)return;const a=viewport.activeAction; a.time=Number(e.target.value)/1000*a.getClip().duration; viewport.mixer.update(0); updateTime();};
function updateTime(){const a=viewport?.activeAction;const dur=a?.getClip().duration||0;const t=a?Math.min(a.time,dur):0;$('#scrub').value=dur?Math.round(t/dur*1000):0;const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;$('#time').textContent=`${fmt(t)} / ${fmt(dur)}`;}
if(viewport)viewport.onTimeUpdate=updateTime;
$('#frame').onclick=()=>viewport?.frameModel();
$('#zoom-in').onclick=()=>viewport?.zoom(0.75);
$('#zoom-out').onclick=()=>viewport?.zoom(1.33);
for(const [id,key,method] of [['grid','showGrid','setGridVisible'],['skeleton','showSkeleton','setSkeletonVisible'],['wireframe','wireframe','setWireframe']]) $('#'+id).onclick=e=>{state.preview[key]=!state.preview[key];viewport?.[method](state.preview[key]);e.currentTarget.classList.toggle('on',state.preview[key]);};
function showRigHelp() {
  showModal('Rig your character with Mixamo', `<p class="hint">This character has no skeleton. Mixamo can auto-rig a compatible humanoid character on its own website.</p><ol class="help-list"><li>Open Mixamo and sign in to Adobe.</li><li>Choose <b>Upload Character</b> and follow Mixamo’s auto-rigger steps.</li><li>Download the rigged character as <b>FBX with skin</b>, then upload it here.</li><li>Choose animations on Mixamo, download each as <b>FBX without skin</b>, and import them here.</li></ol><p class="hint">This app cannot sign into Mixamo or run its auto-rigger directly. You’ll complete those steps on Mixamo.</p><a class="btn primary" href="https://www.mixamo.com/#/" target="_blank" rel="noopener noreferrer">Open Mixamo ↗</a>`);
}
$('#help').onclick=()=>showModal('From Mixamo to your model', `<ol class="help-list"><li>Upload a <b>Mixamo-rigged character</b> as GLB or FBX. If your model is not rigged, upload it to Mixamo first and download the rigged character.</li><li>On <a href="https://www.mixamo.com/#/" target="_blank" rel="noopener noreferrer">Mixamo ↗</a>, choose an animation and download it as <b>FBX, Without Skin</b>. Repeat for each move.</li><li>Import the downloaded animation files here. They are added to your animation list automatically.</li><li>Preview your moves, then <b>export a GLB</b> containing your model and separate animation clips.</li></ol><p class="hint">Files stay on your device. Mixamo is operated by Adobe; this app does not connect to its catalog or download animations directly. Retargeting works best with Mixamo-compatible rigs and may need adjustment for different skeletons. Self-contained GLB is recommended; external textures in separate files are not supported.</p>`);
function showModal(title, body){$('#modal-root').innerHTML=`<div class="overlay"><div class="modal"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" id="close-modal">${icon('close')}</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" id="done-modal">Got it</button></div></div></div>`;$('#close-modal').onclick=$('#done-modal').onclick=()=>$('#modal-root').innerHTML=''; $('.overlay').onclick=e=>{if(e.target===e.currentTarget)$('#modal-root').innerHTML='';};}
$('#export').onclick=async()=>{
 if(!viewport || !state.model || !state.sequence.length)return;
 try {
   state.preview.playing=false;
   // Stop actions to restore the destination bind pose before baking/export.
   viewport.invalidateCache();
   await new Promise(r=>setTimeout(r,20));
   const clips=state.sequence.map(item=>{const prepared=viewport.prepareItem(item);if(!prepared)throw new Error(`Missing clip: ${item.name}`);const clip=prepared.clip.clone();clip.name=item.name;return clip;});
   const buffer=await new GLTFExporter().parseAsync(state.model.root,{binary:true,animations:clips,trs:true,onlyVisible:false});
   const url=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download=state.model.name.replace(/\.[^.]+$/,'')+'-animated.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);update();toast(`Exported GLB with ${clips.length} clips`, 'ok');
 }catch(e){console.error(e);toast('Export failed: '+e.message,'err',8000);}
};
render();

// The optional extension relays a small set of requests through the user's
// own Mixamo tab. It never sends the Mixamo access token to this application.
function bridgeRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {window.removeEventListener('message', receive); reject(new Error('Extension did not respond. Install it and connect this app tab first.'));}, action === 'download' ? 140000 : 15000);
    function receive(e) {
      if (e.source !== window || e.origin !== location.origin || e.data?.source !== 'motion-studio-response' || e.data.id !== id) return;
      clearTimeout(timer); window.removeEventListener('message', receive);
      if (e.data.response?.error) reject(new Error(e.data.response.error)); else resolve(e.data.response);
    }
    window.addEventListener('message', receive);
    window.postMessage({source:'motion-studio-request',id,action,payload}, location.origin);
  });
}
function openMixamoBrowser() {
  showModal('Browse Mixamo animations', `<p class="hint">Sign in to Mixamo in your own browser. This optional Chrome extension uses unofficial endpoints which may change. <a href="/mixamo-bridge.zip" download>Download extension ZIP</a> · <a href="https://www.mixamo.com/#/" target="_blank" rel="noopener noreferrer">Open Mixamo ↗</a></p><details class="bridge-help"><summary>Setup instructions</summary><ol class="help-list"><li>Unzip the extension, open <b>chrome://extensions</b>, enable Developer mode, and choose <b>Load unpacked</b>.</li><li>Sign in to Mixamo in another tab and select a rigged character.</li><li>In Mixamo, open browser Developer Tools → Network, select an animation and find the <code>character_id</code> in a product request. This is not a password or token.</li><li>Return to this app, open the extension, enter the character ID and choose <b>Connect this page</b>.</li></ol><p class="hint">Use the same character on Mixamo and in this app for best results. This bridge does not upload or auto-rig models. Never paste passwords or access tokens into the app.</p></details><div class="row" style="margin-top:14px"><input id="mixamo-query" type="search" placeholder="Search e.g. walking"><button class="btn primary" id="mixamo-search">Search</button></div><p class="hint" id="mixamo-status" role="status">Connect the extension, then search the Mixamo catalog.</p><div id="mixamo-results"></div><button class="btn tiny" id="mixamo-more" style="display:none">Load more</button><div class="row" style="margin-top:16px"><span class="hint grow" id="mixamo-count">0 selected</span><button class="btn primary" id="mixamo-add" disabled>Add selected</button></div>`);
  let page = 1, query = '', busy = false;
  const selected = new Map();
  const status = document.querySelector('#mixamo-status');
  const count = document.querySelector('#mixamo-count');
  const add = document.querySelector('#mixamo-add');
  function updateSelection() {
    count.textContent = `${selected.size} selected`;
    add.disabled = busy || selected.size === 0;
    document.querySelectorAll('#mixamo-results input[type=checkbox]').forEach(input => { input.disabled = busy; input.checked = selected.has(input.dataset.id); });
  }
  const search = async (append = false) => {
    if (busy) return;
    if (!append) { page=1; query=$('#mixamo-query').value.trim(); $('#mixamo-results').innerHTML=''; }
    status.textContent='Loading from Mixamo…'; $('#mixamo-search').disabled=true; $('#mixamo-more').disabled=true;
    try {
      const data=await bridgeRequest('search',{query,page});
      if (!document.querySelector('#mixamo-results')) return;
      status.textContent=data.results.length ? 'Choose the animations you want, then select Add selected.' : 'No animations found.';
      const results=$('#mixamo-results');
      for (const item of data.results) {
        const row=document.createElement('label'); row.className='browse-row';
        const check=document.createElement('input'); check.type='checkbox'; check.dataset.id=item.id; check.checked=selected.has(item.id); check.setAttribute('aria-label', `Select ${item.name}`);
        check.onchange=()=>{ if(check.checked) selected.set(item.id,item); else selected.delete(item.id); updateSelection(); };
        const name=document.createElement('span'); name.className='nm'; name.textContent=item.name;
        row.append(check,name); results.append(row);
      }
      const total=Number(data.pagination?.num_pages || 1); $('#mixamo-more').style.display=page<total?'':'none';
      updateSelection();
    } catch(e) { status.textContent=e.message; if (append) page--; }
    finally { const searchButton=document.querySelector('#mixamo-search'); if(searchButton) searchButton.disabled=false; const more=document.querySelector('#mixamo-more'); if(more) more.disabled=false; }
  };
  add.onclick=async()=>{
    if(!state.model){status.textContent='Upload a rigged character in the app first.';return;}
    const modelId=state.model.id;
    const queue=[...selected.values()];
    busy=true; updateSelection();
    document.querySelector('#mixamo-search').disabled=true;
    document.querySelector('#mixamo-more').disabled=true;
    let imported=0;
    for (const [index,item] of queue.entries()) {
      status.textContent=`Adding ${index+1} of ${queue.length}: ${item.name}…`;
      try {
        if(state.model?.id!==modelId) throw new Error('The character changed. Uploads stopped.');
        const result=await bridgeRequest('download',{id:item.id,name:item.name});
        if(state.model?.id!==modelId) throw new Error('The character changed. Uploads stopped.');
        const binary=atob(result.data); const bytes=new Uint8Array(binary.length);
        for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        const added=await importAnimations([new File([bytes],`${item.name.replace(/[\\/]/g,'_')}.fbx`,{type:'application/octet-stream'})]);
        if (!added) throw new Error('Animation could not be imported.');
        selected.delete(item.id); imported++;
      } catch(e) {
        status.textContent=`Added ${imported} of ${queue.length}. ${item.name}: ${e.message} Remaining selections were kept for retry.`;
        busy=false; updateSelection();
        const searchButton=document.querySelector('#mixamo-search'); if(searchButton) searchButton.disabled=false;
        const more=document.querySelector('#mixamo-more'); if(more) more.disabled=false;
        return;
      }
    }
    status.textContent=`Added ${imported} animation${imported===1?'':'s'} to your character. Select one in the animation list to preview.`;
    document.querySelectorAll('#mixamo-results input[type=checkbox]').forEach(input=>input.checked=false);
    busy=false; updateSelection();
    const searchButton=document.querySelector('#mixamo-search'); if(searchButton) searchButton.disabled=false;
    const more=document.querySelector('#mixamo-more'); if(more) more.disabled=false;
  };
  $('#mixamo-search').onclick=()=>search();
  $('#mixamo-query').onkeydown=e=>{if(e.key==='Enter')search();};
  $('#mixamo-more').onclick=()=>{page++;search(true);};
}
