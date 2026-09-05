/**
 * Whether inference-config commands (/model, /fast, /effort) should execute
 * immediately (during a running query) rather than waiting for the current
 * turn to finish.
 *
 * These commands only change what the NEXT turn uses — they don't mutate the
 * running query — so they are always safe to run mid-turn.
 */
export function shouldInferenceConfigCommandBeImmediate(): boolean {
  return true
}
