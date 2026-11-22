// Motion Studio — PlayerMovement for the CharacterController setup.
// Drop into Assets/ next to your other scripts (keep the class name PlayerMovement).
// WASD = walk, Shift+WASD = run, Space = jump, no input = idle.
using UnityEngine;

public class PlayerMovement : MonoBehaviour
{
    [Header("Movement")]
    public float walkSpeed = 3f;
    public float runSpeed = 6f;
    public float rotationSpeed = 10f;
    public float jumpHeight = 1.5f;
    public float gravity = -20f;

    [Header("Animation")]
    public Animator animator;                 // the model child's Animator
    public string idleState = "Idle";
    public string walkState = "Walk";
    public string runState = "Run";
    public string jumpState = "Jump";

    private CharacterController controller;
    private float verticalVelocity;
    private string currentState;

    void Start() { controller = GetComponent<CharacterController>(); }

    void Update()
    {
        bool grounded = controller.isGrounded;
        if (grounded && verticalVelocity < 0f) verticalVelocity = -2f;

        float x = Input.GetAxisRaw("Horizontal");
        float z = Input.GetAxisRaw("Vertical");
        bool sprint = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);

        Vector3 direction = new Vector3(x, 0f, z);
        bool hasInput = direction.sqrMagnitude > 0.01f;
        if (hasInput) direction.Normalize();

        if (Input.GetKeyDown(KeyCode.Space) && grounded)
            verticalVelocity = Mathf.Sqrt(2f * -gravity * jumpHeight);

        verticalVelocity += gravity * Time.deltaTime;

        float speed = sprint ? runSpeed : walkSpeed;
        Vector3 planar = hasInput ? direction * speed : Vector3.zero;
        controller.Move((planar + Vector3.up * verticalVelocity) * Time.deltaTime);

        if (hasInput)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction);
            transform.rotation = Quaternion.Slerp(
                transform.rotation, targetRotation, rotationSpeed * Time.deltaTime);
        }

        grounded = controller.isGrounded;
        if (!grounded)      Play(jumpState);
        else if (hasInput)  Play(sprint ? runState : walkState);
        else                Play(idleState);
    }

    void Play(string state)
    {
        if (currentState == state || animator == null) return;
        currentState = state;
        animator.Play(state, 0, 0f);
    }
}
