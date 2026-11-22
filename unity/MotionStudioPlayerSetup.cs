// Motion Studio — one-click repair for the common
// "character doesn't move / walks through the floor / terrain is glued to the model"
// misconfigurations after importing a Motion Studio GLB.
//
// INSTALL: create a folder Assets/Editor in your Unity project and paste this file in.
//          Unity will compile it automatically, then open:
//          Tools ▸ Motion Studio ▸ Fix Player Setup
//
// It never deletes anything except the redundant Animator on the wrapper
// (it simply re-parents and (re)configures components, and logs a full report).

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class MotionStudioPlayerSetup
{
    [MenuItem("Tools/Motion Studio/Fix Player Setup")]
    public static void Run()
    {
        var report = new List<string>();
        var problems = new List<string>();

        // ---------- 1. locate the character (scene root of the skinned meshes) ----------
        var skinned = UnityEngine.Object.FindObjectsOfType<SkinnedMeshRenderer>(true);
        if (skinned.Length == 0)
        {
            Fail("No skinned character found in the scene. Drag the exported GLB into the scene first.");
            return;
        }

        var roots = new List<Transform>();
        foreach (var sm in skinned)
        {
            var t = sm.transform;
            while (t.parent != null) t = t.parent;
            if (!roots.Contains(t)) roots.Add(t);
        }

        var charRoot = roots
            .OrderByDescending(r => r.GetComponentsInChildren<SkinnedMeshRenderer>(true).Length)
            .ThenByDescending(r => r.name.IndexOf("animated", StringComparison.OrdinalIgnoreCase) >= 0 ? 1 : 0)
            .First();
        report.Add($"Character root: {charRoot.name} ({charRoot.GetComponentsInChildren<SkinnedMeshRenderer>(true).Length} skinned meshes)");
        if (roots.Count > 1)
            report.Add("Note: other skinned objects in scene: " + string.Join(", ", roots.Where(r => r != charRoot).Select(r => r.name)));

        // ---------- 2. a scale-1 wrapper named Player that holds the character ----------
        var feetY = FeetY(charRoot);
        GameObject wrapper = GameObject.Find("Player");
        if (wrapper == null || wrapper.transform == charRoot || Math.Abs(wrapper.transform.localScale.x - 1f) > 0.001f)
        {
            wrapper = new GameObject("Player");
            wrapper.transform.position = new Vector3(charRoot.position.x, feetY, charRoot.position.z);
            wrapper.transform.rotation = Quaternion.Euler(0f, charRoot.eulerAngles.y, 0f);
            report.Add("Created scale-1 Player wrapper at the character's feet.");
        }
        else
        {
            report.Add("Reusing the existing Player object as wrapper.");
        }

        if (charRoot.parent != wrapper.transform)
        {
            charRoot.SetParent(wrapper.transform, true); // keep world position
            report.Add($"Parented {charRoot.name} under Player.");
        }
        // wrapper must be a scene root
        wrapper.transform.SetParent(null, true);
        wrapper.transform.localScale = Vector3.one;

        // ---------- 3. the terrain must NOT be a child of the character ----------
        foreach (var terrain in UnityEngine.Object.FindObjectsOfType<Terrain>(true))
        {
            if (terrain.transform.IsChildOf(wrapper.transform))
            {
                terrain.transform.SetParent(null, true);
                report.Add("Moved Terrain out of the character hierarchy (it inherits the GLB's tiny scale and would swallow the character).");
            }
        }

        // ---------- 4. CharacterController on the wrapper ----------
        var redundantAnimator = wrapper.GetComponent<Animator>();
        if (redundantAnimator != null)
        {
            UnityEngine.Object.DestroyImmediate(redundantAnimator);
            report.Add("Removed the redundant Animator on Player (only the model child should have one).");
        }

        var cc = wrapper.GetComponent<CharacterController>();
        if (cc == null) cc = wrapper.AddComponent<CharacterController>();
        cc.height = 1.8f;
        cc.radius = 0.35f;
        cc.center = new Vector3(0f, 0.9f, 0f);
        cc.stepOffset = 0.3f;
        cc.slopeLimit = 45f;
        report.Add("CharacterController: height 1.8, radius 0.35, center (0, 0.9, 0).");

        // ---------- 5. PlayerMovement on the wrapper, wired to the model's Animator ----------
        var moveType = FindPlayerMovementType();
        var childAnimator = charRoot.GetComponentInChildren<Animator>(true);

        if (moveType == null)
        {
            problems.Add("PlayerMovement script type not found — check the Console for red compile errors (the script must be named PlayerMovement and be in the project).");
        }
        else
        {
            var comp = wrapper.GetComponent(moveType) as MonoBehaviour;
            if (comp == null) { comp = wrapper.AddComponent(moveType) as MonoBehaviour; report.Add("Added PlayerMovement to Player."); }
            else report.Add("PlayerMovement already on Player.");

            if (childAnimator == null)
            {
                problems.Add("No Animator found inside the character — reimport the GLB with Animation = Mecanim and re-drag it into the scene.");
            }
            else
            {
                var so = new SerializedObject(comp);
                var prop = so.FindProperty("animator");
                if (prop != null) { prop.objectReferenceValue = childAnimator; so.ApplyModifiedProperties(); report.Add("PlayerMovement.animator → the model child's Animator."); }
                else problems.Add("PlayerMovement has no serialized 'animator' field — make sure the script is the one from the guide.");

                if (childAnimator.runtimeAnimatorController == null)
                {
                    var guid = AssetDatabase.FindAssets("playeranimator t:RuntimeAnimatorController").FirstOrDefault();
                    if (guid != null)
                    {
                        childAnimator.runtimeAnimatorController =
                            AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(AssetDatabase.GUIDToAssetPath(guid));
                        report.Add($"Assigned Animator controller: {childAnimator.runtimeAnimatorController.name}");
                    }
                    else problems.Add("The model's Animator has no Controller — create playeranimatornew with Idle/Walk/Run/Jump states and assign it.");
                }
                else report.Add($"Animator controller OK: {childAnimator.runtimeAnimatorController.name}");

                if (childAnimator.applyRootMotion) { childAnimator.applyRootMotion = false; report.Add("Apply Root Motion turned off."); }
                childAnimator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
                childAnimator.updateMode = AnimatorUpdateMode.Normal;

                if (childAnimator.runtimeAnimatorController != null)
                {
                    var clips = childAnimator.runtimeAnimatorController.animationClips;
                    report.Add("Controller clips: " + string.Join(", ", clips.Select(c => c != null ? c.name : "?")));
                    foreach (var needed in new[] { "Idle", "Walk", "Run", "Jump" })
                    {
                        // names refer to states, so just nudge the user on silent states
                    }
                }
            }
        }

        // ---------- 6. snap feet to the ground ----------
        feetY = FeetY(charRoot);
        var terrain = UnityEngine.Object.FindObjectsOfType<Terrain>(true).FirstOrDefault();
        if (terrain != null)
        {
            float ground = terrain.transform.position.y +
                           terrain.SampleHeight(new Vector3(wrapper.transform.position.x, 0f, wrapper.transform.position.z));
            wrapper.transform.position += Vector3.up * (ground - feetY);
            report.Add($"Snapped feet to terrain height ({ground:F2}).");
        }
        else
        {
            wrapper.transform.position += Vector3.up * (0f - feetY);
            report.Add("Snapped feet to y=0.");
        }

        // ---------- 7. stray duplicates worth a look (never deleted) ----------
        foreach (var name in new[] { "Idle", "Walk", "Run", "Jump" })
        {
            var go = GameObject.Find(name);
            if (go != null)
                report.Add($"Note: a scene object named '{name}' exists — delete it if it's an empty leftover.");
        }

        EditorSceneManager.MarkSceneDirty(wrapper.scene);

        // ---------- report ----------
        var summary = "Motion Studio — setup report\n\n" +
                      string.Join("\n", report.Select((m, i) => $"{i + 1}. {m}"));
        summary += problems.Count > 0
            ? "\n\nPROBLEMS:\n" + string.Join("\n", problems.Select((m, i) => $"{i + 1}. {m}")) +
              "\n\nFix those, then run the menu item again."
            : "\n\nAll wired. Save the scene (Ctrl+S) and press Play.";
        Debug.Log("[MotionStudio] " + summary);
        EditorUtility.DisplayDialog("Motion Studio — Fix Player Setup", summary, "OK");
    }

    static float FeetY(Transform root)
    {
        float min = float.MaxValue;
        foreach (var r in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            min = Mathf.Min(min, r.bounds.min.y);
        return min == float.MaxValue ? root.position.y : min;
    }

    static Type FindPlayerMovementType()
    {
        foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
        {
            try { var t = asm.GetType("PlayerMovement"); if (t != null) return t; }
            catch { /* ignore */ }
        }
        return null;
    }

    static void Fail(string message)
    {
        Debug.LogError("[MotionStudio] " + message);
        EditorUtility.DisplayDialog("Motion Studio — Fix Player Setup", message, "OK");
    }
}
