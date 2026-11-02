import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { BrandMark, LogoutIcon, PauseIcon, PlayIcon, ReplayIcon, SkipIcon } from "./ui.jsx";

const SPEEDS = [["Slow", 1100], ["Normal", 700], ["Fast", 250]];

/** A labelled select. With no visible label (the value says it all, like "English"), `title` still names it for screen readers. */
function Pill({ label, title, children }) {
  return <label className="pill-select" title={title}>{label && <span>{label}</span>}{children}</label>;
}

/** Replay controls. They live in the top bar so they stay in reach on every screen size. */
function MatchControls() {
  const { match, playing, seq, states, ballMs, lang, team, active } = useStore();
  const { play, pause, restart, setBallMs, setLang, setTeam, endBreak } = useStore.getState();
  const finished = seq >= states.length - 1;

  const main = playing
    ? { label: "Pause", icon: <PauseIcon />, onClick: pause }
    : finished
      ? { label: "Play again", icon: <PlayIcon />, onClick: () => restart({ autoplay: true }) }
      : { label: seq < 0 ? "Start replay" : "Resume", icon: <PlayIcon />, onClick: play };

  return (
    <div className="controls" role="group" aria-label="Replay controls">
      <button className="btn primary" onClick={main.onClick}>{main.icon}{main.label}</button>
      <button className="btn" onClick={() => restart({ autoplay: true })} disabled={seq < 0}
        title="Start again from the first ball. This clears your predictions.">
        <ReplayIcon />Replay
      </button>
      {active && <button className="btn warn" onClick={endBreak}><SkipIcon />Skip break</button>}
      <span className="sep" aria-hidden="true" />
      <Pill label="Speed">
        <select value={ballMs} onChange={(e) => setBallMs(Number(e.target.value))}>
          {SPEEDS.map(([n, v]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </Pill>
      <Pill title="Language of the briefing">
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="hinglish">Hinglish</option>
          <option value="en">English</option>
        </select>
      </Pill>
      <Pill label="Team" title="Your team: the briefing leans towards how this side is doing">
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="any">No favourite</option>
          {match.teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Pill>
    </div>
  );
}

function UserMenu() {
  const user = useStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="user" ref={ref}>
      <button className="avatar" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user.email}`}>
        {user.email[0].toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-email" title={user.email}>{user.email}</p>
          <a role="menuitem" href="#/predictions" onClick={() => setOpen(false)}>My predictions</a>
          <button role="menuitem" onClick={() => useStore.getState().signOut()}><LogoutIcon />Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const route = useStore((s) => s.route);
  const inMatch = route.name === "match";
  const ready = useStore((s) => Boolean(s.match));

  return (
    <header className="topbar">
      <a className="brand" href="#/matches" aria-label="Break Mode, go to matches"><BrandMark /><span>Break Mode</span></a>
      <nav className="nav" aria-label="Main">
        <a href="#/matches" className={route.name === "matches" || inMatch ? "on" : ""} aria-current={route.name !== "predictions" ? "page" : undefined}>Matches</a>
        <a href="#/predictions" className={route.name === "predictions" ? "on" : ""} aria-current={route.name === "predictions" ? "page" : undefined}>Predictions</a>
      </nav>
      <div className="bar-right">
        {inMatch && ready && <MatchControls />}
        <UserMenu />
      </div>
    </header>
  );
}
