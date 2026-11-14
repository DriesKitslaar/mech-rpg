/** What the Android shell offers the page; see `MainActivity.Shell`. */
export interface NativeShell { vibrate?: (ms: number) => void }

/**
 * Returns the way to make this device rumble for a number of milliseconds. Inside the Android shell
 * the motor is driven by the shell: controller presses reach the page as script-made key events,
 * which a browser does not count as a user gesture, so the page's own `navigator.vibrate` is
 * refused there. Anywhere else the browser is asked. A device that cannot or will not is left alone.
 */
export function vibrator(shell: NativeShell | undefined, nav: { vibrate?: (ms: number) => unknown }): (ms: number) => void {
  return (ms) => {
    try {
      // The method is called on the shell itself: a bridge to Java does not work as a loose function.
      if (shell && typeof shell.vibrate === 'function') shell.vibrate(Math.round(ms));
      else nav.vibrate?.(ms);
    } catch {
      // Not allowed here, or no motor: the game is the same without it.
    }
  };
}
