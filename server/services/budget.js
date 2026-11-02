/** Sliding-window cap on paid model calls, so a runaway loop or abuse cannot drain the API key. */
export function createBudget(max, windowMs = 3_600_000, now = Date.now) {
  let stamps = [];
  return {
    take() {
      const t = now();
      stamps = stamps.filter((s) => t - s < windowMs);
      if (stamps.length >= max) return false;
      stamps.push(t);
      return true;
    },
  };
}
