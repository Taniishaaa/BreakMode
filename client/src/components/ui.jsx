// Small shared pieces: icons, team crests, number formatting.
const I = (d, extra) => (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {d}{extra}
  </svg>
);
export const PlayIcon = I(<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />);
export const PauseIcon = I(<><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></>);
export const ReplayIcon = I(<><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v4.5h4.5" /></>);
export const SkipIcon = I(<><path d="M5 5l10 7-10 7z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></>);
export const LogoutIcon = I(<><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" /></>);
export const EyeIcon = I(<><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = I(<><path d="M3 3l18 18" /><path d="M10.6 5.6A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3 3.8M6.5 7.2A16 16 0 0 0 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>);

export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Round team badge. `idx` picks one of the two team colours so a side keeps its colour everywhere. */
export function Crest({ name, idx = 0, size = "md" }) {
  return <span className={`crest t${idx} ${size}`} aria-hidden="true">{initials(name)}</span>;
}

export const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);

/** Plain-language label for a stoppage type. */
export const STOP_NAME = {
  wicket: "Wicket", review: "Review", strategic_timeout: "Strategic timeout", ad_break: "Ad break", innings_break: "Innings break",
};

export function BrandMark({ size = 28 }) {
  // a ball with a seam; the seam is broken by a gap, which is the idea of the product
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="var(--lamp)" />
      <path d="M6.5 8.5c4 2.2 6 5.2 6 7.5s-2 5.3-6 7.5" fill="none" stroke="var(--lamp-ink)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M25.5 8.5c-4 2.2-6 5.2-6 7.5s2 5.3 6 7.5" fill="none" stroke="var(--lamp-ink)" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="14.4" y="9" width="3.2" height="14" rx="1.6" fill="var(--night-0)" />
    </svg>
  );
}
