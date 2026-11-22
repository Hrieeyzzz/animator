# Unity setup for Motion Studio GLBs (glTFast)

Unity does **not** import `.glb` with its FBX/Model importer. It uses the
**glTFast** package (`com.unity.cloud.gltfast`), whose importer has no Rig /
Humanoid / Generic "Animation Type" setting at all. If you're looking for a
Rig tab, it doesn't exist — this page describes the actual knobs.

A GLB from Motion Studio is imported as a **scene asset**; the clips are its
sub-assets. The clip names are exactly the "Animation name" fields from the
app's animation list.

## 1. Pick the animation system (Settings tab)

Select the GLB → Inspector → **Settings** tab → the **`Animation`** dropdown:

- **`Legacy`** (what your project shows) — clips become legacy clips and the
  importer adds an `Animation` component with every clip on it (clip slots in
  Element 0..N, `Animation` set to index 0). `Play Automatically` is off, and
  the legacy system silently ignores the `Animator` your script uses — so a
  game object with an unchecked legacy `Animation` + an `Animator` with no
  controller plays **nothing**. This is the most common cause of "walks but
  stays in bind pose".
- **`Mecanim`** (recommended) — clips become Mecanim clips, the importer adds
  an **`Animator`** instead of the legacy `Animation` component, and **all
  clips get `Loop Time = true` automatically** (no Animation tab needed).
  Avatars are never created by glTFast and are **not needed**: these clips
  bind to transform paths, so `Avatar = None` is correct, not a bug.
- `None` — clips are not imported at all.

Then click **Apply** to reimport. After switching from Legacy to Mecanim,
delete the scene instance/prefab you had and re-drag the model into the
scene, so no stale legacy `Animation` component remains.

Which to choose:

- If a movement script drives an `Animator` (`animator.Play(...)` /
  `CrossFade(...)` with state names) → **Mecanim**.
- If you prefer the legacy component → set `Animation = Legacy`, check
  **Play Automatically**, delete/ignore the `Animator`, and play clips from
  code with `animation.Play("Feminine Walk Forward")` — renaming state strings
  like `Walk`/`Idle` does nothing for the legacy system.

## 2. The variants in detail (Mecanim path)

After switching to Mecanim and re-dragging the model in:

1. **Expand the GLB asset in the Project window** — you'll see its
   `AnimationClip` sub-assets. Note the exact clip names.
2. **Create an Animator Controller** (right-click in Project → Create →
   Animator Controller), and add states named **exactly** as the strings your
   script uses (e.g. `Walk` and `Idle` for a simple locomotion switch, or
   whatever `PlayerMovement` sets in its `Walk State` / `Idle State` fields).
3. **Set each state's Motion** to the matching clip:
   - `Walk` → e.g. `Feminine Walk Forward`
   - `Idle` → any exported idle clip (export one, e.g. "Breathing Idle", if
     it isn't in this GLB yet — otherwise the Idle state has nothing to play)
4. **Assign the controller** to the Animator's **Controller** field on the
   character.
5. **Delete the legacy `Animation` component** if it's still around. The
   Animator window shows the `Walk` state lighting up while you move if the
   wiring is right; if it doesn't light up, the script's state name doesn't
   match — always match the exact strings.
6. No transitions are needed for a script-driven `animator.Play("Walk")`
   switch; add transitions only if you use condition parameters/triggers.

## 3. Root motion: pick one owner

- Script moves the transform (`CharacterController` / `transform.position`)
  and the clip was exported **without** root motion (the app's **Include root
  motion** unchecked → hip track dropped → baked "in place"). Then uncheck
  **Apply Root Motion**. This is the recommended setup for a simple
  CharacterController.
- Script doesn't move the transform and the clip **has** hip translation
  (exported with **Include root motion** checked). Then keep **Apply Root
  Motion** checked. The Animator drives movement.
- Mixing both (script translation **and** baked root motion **and** Apply
  Root Motion on) looks like double-speed sliding/jittering.
- Keeping **Include root motion** on while Apply Root Motion is **off** makes
  the mesh walk forward in local space and snap back on every loop — also a
  common surprise.

## 4. Clip names

Exported clip names come straight from the "Animation name" fields in
Motion Studio's animation list. A name like
`Jog In Circle@Sitting Clap@Fallen Idle` is the Mixamo file name used when
no explicit name was set; rename the item in the app and re-export for sane
Animator states.

## 5. Symptoms

| Symptom | Cause | Fix |
| --- | --- | --- |
| Walks but stays in bind pose | Legacy clips never reach the Animator your script drives; or Mecanim clips + Animator with **Controller = None** | §1 switch to Mecanim (or delete Animator + use legacy `Play`), §2 assign controller |
| State lights up/none in Animator, no motion | `Walk State` string doesn't match any state name | make the state name and the string identical |
| Animations never loop | glTFast Mecanim clips loop automatically; you selected Legacy but expect Mecanim semantics | §1 Mecanim |
| Double speed / sliding | script movement + baked root motion | §3 pick one owner |
| Clip name `Jog In Circle@...` hard to use | list item names in app | rename + re-export |
| No `Avatar` slot needed | glTFast never creates avatars; transform-path clips don't need one | ignore the Avatar field |

## 6. Fast verification

1. GLB → Settings → Animation = **Mecanim** → Apply; re-drag the model into
   the scene.
2. Animator window → move → watch `Walk` light up.
3. Mesh animates → done. State lights up but mesh doesn't → the state's
   Motion field is empty, or the clip binding paths don't match the rig.
4. State doesn't light up → name mismatch between script and state.
