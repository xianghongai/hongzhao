/**
 * Formats a UTC offset as `UTC+8`, `UTC-3:30` or `UTC±0`.
 * `offsetMinutes` follows `Date#getTimezoneOffset`: minutes to add to local time to get UTC, so UTC+8 is -480.
 */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) {
    return 'UTC±0';
  }
  const east = -offsetMinutes;
  const hours = Math.floor(Math.abs(east) / 60);
  const minutes = Math.abs(east) % 60;
  return `UTC${east > 0 ? '+' : '-'}${hours}${minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`}`;
}

/** The device's IANA time zone, such as `Asia/Shanghai`, or an empty string when the browser does not report one. */
export function timeZoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
}

/** Formats a moment in local time as `2026-09-28 14:03:05`. */
export function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
