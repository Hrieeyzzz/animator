/**
 * Detect tracks that carry world travel on nodes representing the character's
 * origin (hips / pelvis / scene root) — the tracks that cause "the mesh walks
 * a few steps forward then snaps back" when played in place with Unity's
 * Apply Root Motion turned off.
 *
 * Used by the viewport to bake "in place" clips and by the exporter to verify
 * the result before downloading.
 */

/** Everything before the last '.' in a track name (the node binding path). */
export function nodeOfTrack(trackName) {
  if (!trackName) return '';
  const i = String(trackName).lastIndexOf('.');
  return i === -1 ? String(trackName) : String(trackName).slice(0, i);
}

/**
 * True when this track moves the character's origin node, so it must be
 * dropped for an in-place clip. Node prefix (e.g. "mixamorig:Hips") is fine;
 * we only care about the node's own name ending.
 */
export function isInPlaceDropTrack(trackName) {
  const name = String(trackName ?? '');
  if (!/\.position$/i.test(name)) return false;
  const node = nodeOfTrack(name);
  // Common hip bones (any vendor prefix), the glTF/Armature scene root, and
  // glTFast's auto-generated root nodes like "Node-0".
  return /(hips?|pelvis|hip\s*bone|hip_?bone|armature|^root$|^rootbone$|^scene$|^node[-_\s]*\d+$)/i.test(node);
}

/**
 * Return the names of any travel tracks still present in a clip — e.g. for
 * the exporter's post-export verification pass. Unit-independent (name based).
 */
export function remainingDriftTracks(clip) {
  const hits = [];
  for (const t of clip?.tracks ?? []) {
    if (isInPlaceDropTrack(t.name)) hits.push(t.name);
  }
  return hits;
}
