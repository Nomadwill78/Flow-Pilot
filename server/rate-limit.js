/**
 * Per-user rate limiting.
 *
 * In-memory on purpose: one process, zero dependencies, good to a few thousand
 * users. Swap the Map for Redis when you run more than one instance —
 * `check()` is the only function you need to reimplement.
 */
export function createRateLimiter({ perMinute = 20, perDay = 300 } = {}) {
  const minuteWindow = new Map(); // userId -> { count, resetAt }
  const dayWindow = new Map();

  function bump(store, userId, windowMs, limit) {
    const now = Date.now();
    const entry = store.get(userId);

    if (!entry || now > entry.resetAt) {
      store.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= limit) return false;

    entry.count++;
    return true;
  }

  // Keep memory bounded on long-running instances.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const store of [minuteWindow, dayWindow]) {
      for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
      }
    }
  }, 60_000);
  sweep.unref?.();

  return {
    check(userId) {
      if (!bump(dayWindow, userId, 86_400_000, perDay)) {
        return { allowed: false, scope: 'day' };
      }
      if (!bump(minuteWindow, userId, 60_000, perMinute)) {
        return { allowed: false, scope: 'minute' };
      }
      return { allowed: true };
    },
    /** Current usage for a user, for surfacing quota in your own UI. */
    usage(userId) {
      return {
        minute: minuteWindow.get(userId)?.count ?? 0,
        day: dayWindow.get(userId)?.count ?? 0,
      };
    },
  };
}
