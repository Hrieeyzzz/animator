# Unity setup for Motion Studio GLBs

Motion Studio exports **one GLB** with your model and each clip from your
animation list as a separate animation. Unity imports all of it, but it does
not wire anything up for you. If the Animator is not configured, the character
stays in its bind pose (T-pose) no matter what your movement script does.

This page covers the import settings and the two wiring mistakes that cause a
"the character walks but stays in T-pose" result.

## 1. Import settings

Select the GLB in the Project window and check the three tabs:

- **Rig** → set *Animation Type* to **Generic** (or **Humanoid** for a
  character you want to retarget to other avatars). Turn on **Create From This
  Model**, then **Apply**. An avatar is now generated as a child of the GLB
  asset.
- **Animation** → tick **Loop Time** on every locomotion / idle clip that
  should repeat, and rename clips here if you want (the GLB clip names come
  from the animation names in Motion Studio). **Apply**.
- **Model** → leave everything default; export uses Y-up metres and 0.03-style
  uniform scales are not required — but if your character looks tiny or huge,
  this is the tab, and the exported GLB carries the model's own scale
  untouched.

## 2. Avatar on the Animator

Drag the model into the scene (this auto-assigns the generated avatar), **or**
keep your existing prefab and drag the generated avatar from the GLB asset
into the prefab's **Animator → Avatar** slot.

`Avatar = None` is the single most common reason a skinned character never
moves: the Animator can evaluate controller states but has no skeleton to
drive, so every pose stays the bind pose.

Then:

- If your movement script translates the Transform itself (e.g. `CharacterController` / `transform.position`), **uncheck Apply Root Motion** so the script and the animation don't fight.
- If you want the animation to move the character, **keep Apply Root Motion checked** and stop moving the Transform in the script. Pick one, not both — mixing them looks like sliding or jitter while walking.

## 3. Controller states

Open your Animator controller (`PlayerAnimator`). It needs states whose names
match the strings your script plays (`walkState` / `idleState`, or whatever
`animator.Play(...)` / `CrossFade(...)` is called with):

- Create an empty state, name it **Walk**, set its **Motion** to the walk clip
  (e.g. `Feminine Walk Forward`).
- Create **Idle**, Motion = an idle clip. Note the exported GLB only contains
  the clips you added in the app — if you never added an idle, export one and
  re-import.
- Add transitions if you use condition parameters, or leave a direct
  `animator.Play("Walk")`-style script alone (no transitions needed for a
  simple locomotion switch).

Clip names in the GLB are exactly the "Animation name" fields shown in the
app's animation list. If you see a mashed-up name like
`Jog In Circle@Sitting Clap@Fallen Idle`, rename the items in the list before
exporting (or rename in the Animation tab of the import settings).

## 4. Root motion at export time

In Motion Studio each clip has **Include root motion**:

- Checked (default): the hips carry their travel curve into the GLB. Good for
  motion that should drive movement via Unity's Apply Root Motion.
- Unchecked: the clip is baked in place (hip position track dropped). Good
  for a script-driven `CharacterController` or `transform` movement with
  Apply Root Motion off.

Mixing these two — script moving the character *and* an in-place clip *and*
Apply Root Motion on — is the second most common reason movement looks wrong
(sliding/jitter), after the Avatar being None.

## 5. Common symptoms

| Symptom | Cause | Fix |
| --- | --- | --- |
| Walks but stays in T-pose | Animator `Avatar = None`, or controller state has no Motion, or script plays a state name that does not exist | §1 Rig tab, §2 avatar, §3 state names |
| Clip never plays, character snaps to a pose once | `Loop Time` off in Animation tab | §1 Animation tab |
| Slides / double speed while walking | Transform moved by script **and** by root motion | §2 pick one root-motion owner |
| Character explodes off-screen after a few frames | Root motion baked into clip + Apply Root Motion + script moving too | §4 export the clip in place, uncheck Apply Root Motion |
| `Jog In Circle@Sitting Clap@Fallen Idle` clip name | Clip names come from list item names | Rename in app before export |
| Script plays `Feminine Walk Forward` on legacy `Animation`, Animator unused | Components on one object drive different systems | Delete the legacy `Animation` component (it also has Play Automatically off) and keep only the Animator path |

## 6. Quick verification

1. Select the character in Play mode and open the **Animator** window: the
   `Walk`/`Idle` state should light up when you move.
2. If it never lights up, the script is playing a name that doesn't match a
   state — check the exact strings.
3. If it lights up but the mesh doesn't move, the Avatar is None.
