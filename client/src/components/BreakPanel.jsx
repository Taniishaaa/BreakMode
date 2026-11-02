import { useEffect, useMemo, useState } from "react";
import { candidateQuestions, buildContext, fallbackCard, insightChips, resolveAtSeq } from "@bm/engine";
import { useStore } from "../store";
import { api } from "../api";
import { STOP_NAME } from "./ui.jsx";

const TITLE = { ...STOP_NAME, review: "Review under way" };
const LOCK_NOTE = {
  review: "Locked in. The result shows when play resumes.",
  chase_result: "Locked in. Scored when the match ends.",
};
// The three questions every briefing answers.
const HEADINGS = {
  en: { happened: "What happened", matters: "Why it matters", watch: "What to watch next", stays: "If it stays", changes: "If it changes" },
  hinglish: { happened: "Kya hua", matters: "Kyun matter karta hai", watch: "Agla kya dekhein", stays: "Agar wahi rahe", changes: "Agar badle" },
};

function Briefing({ st, active }) {
  const { match, states, lang, team, picks, cards } = useStore();
  const live = Boolean(active);
  const [left, setLeft] = useState(active ? active.endsAt - Date.now() : 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const H = HEADINGS[lang] ?? HEADINGS.en;

  const specs = useMemo(() => candidateQuestions(match, states, st), [match, states, st]);
  const ctx = useMemo(() => buildContext(match, states, st, specs, team), [match, states, st, specs, team]);
  const template = useMemo(() => fallbackCard(ctx, lang), [ctx, lang]);
  const chips = useMemo(() => insightChips(ctx, lang), [ctx, lang]);
  const key = `${st.id}|${lang}|${team}`;
  const got = cards[key];

  // fetch the AI card (cached on the server); the template shows instantly meanwhile
  useEffect(() => {
    if (cards[key]) return;
    api.getBreak({ stoppageId: st.id, lang, team })
      .then((r) => useStore.getState().setCard(key, { card: r.card, source: r.source }))
      .catch(() => useStore.getState().setCard(key, { card: template, source: "template" }));
  }, [key]);

  // countdown while the break is live; play resumes at zero
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const ms = active.endsAt - Date.now();
      setLeft(Math.max(ms, 0));
      if (ms <= 0) useStore.getState().endBreak();
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [active?.endsAt]);

  const card = got?.card ?? template;
  const isAI = got && (got.source === "llm" || got.source === "cache");
  const pick = picks[st.id];
  const spec = specs.find((q) => q.id === (pick?.questionId ?? card.chosen_question_id)) ?? specs[0];
  const pct = active ? Math.min(100, (left / active.totalMs) * 100) : 0;
  const optLabel = (o) => (lang === "hinglish" ? o.labelHing : o.labelEn);

  async function choose(optionId) {
    setSaving(true); setError(null);
    try {
      const row = await api.predict({ stoppageId: st.id, questionId: spec.id, optionId });
      const q = specs.find((x) => x.id === row.questionId) ?? spec;
      useStore.getState().setPick(st.id, {
        questionId: row.questionId, optionId: row.optionId, resolveAt: resolveAtSeq(match, q),
        status: row.status === "locked" ? "locked" : row.status,
        result: row.status === "locked" ? null : row,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`briefing ${st.type} ${live ? "live" : "ended"}`} aria-label={TITLE[st.type]}>
      {live && <div className="fuse" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>}

      <header className="b-head">
        <h2><span className={`dot ${st.type}`} aria-hidden="true" />{TITLE[st.type]}</h2>
        <span className="tags">
          <span className="tag">{st.source === "injected" ? "simulated" : st.review?.demo ? "demo marker" : "from match data"}</span>
          <span className={`tag ${isAI ? "ai" : ""}`}>{got ? (isAI ? "AI" : "template") : "template, AI loading"}</span>
        </span>
      </header>

      <p className="b-headline">{card.headline}</p>
      {chips.length > 0 && (
        <ul className="chips" aria-label="Key numbers">
          {chips.map((c) => (
            <li key={c.label} className={c.tone ?? ""}><span>{c.label}</span><b>{c.value}</b></li>
          ))}
        </ul>
      )}

      <section className="b-block">
        <h3>{H.happened}</h3>
        <ul>{card.recap.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </section>

      <section className="b-block">
        <h3>{H.matters}</h3>
        <p>{card.why_it_matters}</p>
        {card.review_explainer && (
          <div className="explainer">
            <p>{card.review_explainer.under_review}</p>
            <div className="two">
              <div><b>{H.stays}</b><span>{card.review_explainer.if_stays}</span></div>
              <div><b>{H.changes}</b><span>{card.review_explainer.if_changes}</span></div>
            </div>
          </div>
        )}
      </section>

      <section className="b-block watch">
        <h3>{H.watch}</h3>
        <p>{card.watch_next}</p>
      </section>

      {spec && (
        <section className="predict">
          <p className="q">{lang === "hinglish" ? spec.titleHing : spec.titleEn}</p>
          <div className="opts">
            {spec.options.map((o) => (
              <button key={o.id} disabled={saving || !!pick || !live}
                className={pick?.optionId === o.id ? "picked" : ""} onClick={() => choose(o.id)}>
                {optLabel(o)}
              </button>
            ))}
          </div>
          <p className="note">
            {pick
              ? (pick.status === "locked" || pick.status === "resolving"
                  ? LOCK_NOTE[spec.kind] ?? "Locked in. Scored after the next 6 balls."
                  : pick.result?.why)
              : live ? "Free to play. Points only, no stakes." : "Predictions closed when play resumed."}
          </p>
          {error && <p className="error small">{error}</p>}
        </section>
      )}

      {card.uncertainties?.length > 0 && <p className="unc">Not known: {card.uncertainties.join(", ")}.</p>}

      {live && (
        <footer className="b-foot">
          <span>Play resumes in <b>{Math.ceil(left / 1000)}s</b></span>
          <button className="btn small" onClick={() => useStore.getState().endBreak()}>Skip break</button>
        </footer>
      )}
    </article>
  );
}

function Idle() {
  return (
    <div className="rail-idle">
      <h2>Briefings land here</h2>
      <p>When play stops for a wicket, review, timeout or ad break, you get three quick answers:</p>
      <ul>
        <li><b>What happened</b><span>the dismissal, the call, the recent overs</span></li>
        <li><b>Why it matters</b><span>wickets in hand, required rate, par for the phase</span></li>
        <li><b>What to watch next</b><span>a named batter and the number that changes the equation</span></li>
      </ul>
      <p className="muted">Start the replay from the top bar.</p>
    </div>
  );
}

export default function BreakPanel() {
  const active = useStore((s) => s.active);
  const shown = useStore((s) => s.shown);
  return (
    <aside className="rail" aria-label="Break briefing">
      {shown ? <Briefing key={shown.id} st={shown} active={active?.stoppage.id === shown.id ? active : null} /> : <Idle />}
    </aside>
  );
}
