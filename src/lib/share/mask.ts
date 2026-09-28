/**
 * Shows enough of a key to compare it with the sender's screen, without exposing it to anyone looking on.
 * The number of asterisks is fixed, so it says nothing about the key itself.
 */
export function maskKey(key: string): string {
  const visible = 4;
  return key.length <= visible * 2 ? '*'.repeat(8) : `${key.slice(0, visible)}${'*'.repeat(8)}${key.slice(-visible)}`;
}
