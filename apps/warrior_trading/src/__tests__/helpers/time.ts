/**
 * Freeze Date.now() to return a fixed timestamp.
 * Returns a restore function to undo the freeze.
 */
export function freezeTime(date: Date): () => void {
  const original = Date.now;
  Date.now = () => date.getTime();
  return () => {
    Date.now = original;
  };
}
