import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { BrandMark, EyeIcon, EyeOffIcon } from "./ui.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode, { email, password, confirm }) {
  const errors = {};
  if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
  if (mode === "register" && password.length < 8) errors.password = "Use at least 8 characters.";
  if (mode === "login" && !password) errors.password = "Enter your password.";
  if (mode === "register" && confirm !== password) errors.confirm = "The passwords don't match.";
  return errors;
}

/** The briefing a fan sees at a wicket, taken from the demo match, so the sign-in page shows the product itself. */
function SampleCard() {
  return (
    <figure className="sample" aria-label="Sample briefing from the demo match">
      <div className="sample-head">
        <span className="dot wicket" /><b>Wicket</b>
        <span className="sample-tag">Sample from the demo match</span>
      </div>
      <p className="sample-headline">J. Kapoor out for 9: Delhi Dynamos 10/2</p>
      <dl className="sample-body">
        <div><dt>What happened</dt><dd>R. Patel catches J. Kapoor off T. Khan. That is 2 wickets in the last 8 balls.</dd></div>
        <div><dt>Why it matters</dt><dd>Delhi Dynamos need 171 from 112 balls: 9.16 an over, against the 7.5 they have managed. There is little room for a slow start.</dd></div>
        <div><dt>What to watch next</dt><dd>B. Mehta joins L. Reddy. 12 or more in the next 6 balls brings the required rate down to 9; 6 or fewer lets it climb to 9.34.</dd></div>
      </dl>
    </figure>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); setServerError(null); };
  const switchMode = (m) => { setMode(m); setErrors({}); setServerError(null); };

  async function submit(e) {
    e.preventDefault();
    const found = validate(mode, form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true); setServerError(null);
    try {
      const body = { email: form.email.trim(), password: form.password };
      const session = await (register ? api.register(body) : api.login(body));
      useStore.getState().setSession(session);
      if (!location.hash) location.hash = "#/matches";
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-story">
        <div className="brand"><BrandMark size={34} /><span>Break Mode</span></div>
        <h1>Every break in play, explained.</h1>
        <p className="lede">
          Wickets, reviews, timeouts and ad breaks get a short briefing: what happened, why it matters and what to watch next.
          Then you call the next few balls.
        </p>
        <SampleCard />
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="seg" role="tablist" aria-label="Sign in or create an account">
            <button type="button" role="tab" aria-selected={!register} className={!register ? "on" : ""} onClick={() => switchMode("login")}>Sign in</button>
            <button type="button" role="tab" aria-selected={register} className={register ? "on" : ""} onClick={() => switchMode("register")}>Create account</button>
          </div>

          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <p className="muted">{register ? "Your predictions and points are saved to your account." : "Sign in to open your matches and predictions."}</p>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" inputMode="email" autoComplete="email" autoFocus value={form.email} onChange={set("email")}
              aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} placeholder="you@example.com" />
            {errors.email && <p className="field-err" id="email-err">{errors.email}</p>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="pw">
              <input id="password" type={show ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"}
                value={form.password} onChange={set("password")} aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "pw-err" : register ? "pw-hint" : undefined} placeholder={register ? "At least 8 characters" : "Your password"} />
              <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password ? <p className="field-err" id="pw-err">{errors.password}</p>
              : register && <p className="hint" id="pw-hint">Use at least 8 characters.</p>}
          </div>

          {register && (
            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" value={form.confirm} onChange={set("confirm")}
                aria-invalid={!!errors.confirm} aria-describedby={errors.confirm ? "confirm-err" : undefined} />
              {errors.confirm && <p className="field-err" id="confirm-err">{errors.confirm}</p>}
            </div>
          )}

          <div aria-live="polite">{serverError && <p className="form-err" role="alert">{serverError}</p>}</div>

          <button className="btn primary wide" type="submit" disabled={busy}>
            {busy ? (register ? "Creating account…" : "Signing in…") : (register ? "Create account" : "Sign in")}
          </button>

          <p className="switch">
            {register ? "Already have an account?" : "New here?"}{" "}
            <button type="button" className="linklike" onClick={() => switchMode(register ? "login" : "register")}>
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
