/**
 * Wraps the step that runs every frame so that one thing going wrong does not stop the next frame
 * from being asked for: a game that still draws and still takes a press can often be backed out of
 * what broke. Each fault is reported when it first appears, not again every frame it lasts.
 */
export function guarded(step: (now: number) => void, report: (message: string) => void): (now: number) => void {
  let last: string | null = null;
  return (now) => {
    try {
      step(now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== last) report(message);
      last = message;
    }
  };
}
