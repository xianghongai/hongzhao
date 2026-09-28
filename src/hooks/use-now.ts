import { useEffect, useState } from 'react';

/** The current time, updated on each whole second while `enabled`. */
export function useNow(enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      timer = setTimeout(tick, 1000 - (time % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [enabled]);

  return now;
}
