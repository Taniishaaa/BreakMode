import { useEffect } from "react";
import { useStore } from "./store";

/** Advances the replay one delivery at a time; pauses itself during a break. */
export function useReplay() {
  const playing = useStore((s) => s.playing);
  const active = useStore((s) => s.active);
  const seq = useStore((s) => s.seq);
  const ballMs = useStore((s) => s.ballMs);
  const states = useStore((s) => s.states);

  useEffect(() => {
    if (!playing || active || states.length === 0) return;
    const t = setTimeout(() => {
      const { byAfterSeq, compress, setSeq, pause, startBreak } = useStore.getState();
      const next = seq + 1;
      if (next >= states.length) return pause();
      setSeq(next);
      const st = byAfterSeq[next];
      if (st) startBreak(st, compress);
    }, ballMs);
    return () => clearTimeout(t);
  }, [playing, active, seq, ballMs, states]);
}
