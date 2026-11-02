import { useEffect } from "react";
import { useStore } from "./store";
import { api } from "./api";

/** When the replay reaches a locked prediction's result, ask the server to score it and show a toast. */
export function useResolver() {
  const seq = useStore((s) => s.seq);
  const picks = useStore((s) => s.picks);

  useEffect(() => {
    const { patchPick, pushToast } = useStore.getState();
    for (const [stoppageId, p] of Object.entries(picks)) {
      if (p.status !== "locked" || seq < p.resolveAt) continue;
      patchPick(stoppageId, { status: "resolving" });
      api.resolve({ stoppageId, seq })
        .then((r) => {
          patchPick(stoppageId, { status: r.status, result: r });
          pushToast({ status: r.status, points: r.points ?? 0, why: r.why });
        })
        .catch((e) => {
          patchPick(stoppageId, { status: "error", error: e.message });
          pushToast({ status: "error", points: 0, why: `Could not score this prediction: ${e.message}` });
        });
    }
  }, [seq, picks]);
}
