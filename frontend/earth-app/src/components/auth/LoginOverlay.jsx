import { useEffect, useRef, useState } from 'react';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  checkVpnHeuristic,
  requestLoginLocation,
  verifyDemoCredentials,
} from '../../services/authService';
import './LoginOverlay.css';

export default function LoginOverlay({ onExitStart, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exiting, setExiting] = useState(false);
  const completionTimer = useRef(null);

  useEffect(() => () => clearTimeout(completionTimer.current), []);

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!verifyDemoCredentials(trimmedEmail, password)) {
        setError('Invalid email or password.');
        return;
    }

    setSubmitting(true);
    setStatus('Checking network…');
    try {
      const vpnCheck = await checkVpnHeuristic();
      if (vpnCheck.flagged) {
        setError('VPN or proxy connections are not permitted. Please use a direct connection.');
        return;
      }
      setStatus('Requesting location permission…');
      const location = await requestLoginLocation();
      const session = {
        email: trimmedEmail,
        location,
        loggedInAt: new Date().toISOString(),
      };
      setExiting(true);
      onExitStart?.();
      completionTimer.current = setTimeout(() => onSuccess(session), 900);
    } catch {
      setError('Unable to complete login. Please try again.');
    } finally {
      setSubmitting(false);
      setStatus('');
    }
  };

  return (
      <main className={`login-overlay${exiting ? ' is-exiting' : ''}`}>
        <section className="login-card" aria-labelledby="loginTitle">
          <h1 id="loginTitle">Login</h1>
          <p className="login-sub">Vadodara District — Prototype Access</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="loginEmail">Official email</label>
            <input
              id="loginEmail"
              type="email"
              placeholder="name@vadodara.gov.in"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={event => setEmail(event.target.value)}
            />

            <label htmlFor="loginPassword">Password</label>
            <input
              id="loginPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />

            <div className="login-error" role="alert">{error}</div>
            <div className="login-status" role="status">{status}</div>
            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <div className="login-disclaimer">
            <strong>Prototype notice:</strong> This is an early prototype. In production, access is restricted to an
            official government email address that we authorize directly. VPN/proxy connections are checked on a
            best-effort basis and location is collected only with your explicit browser permission.
          </div>
          <div className="login-dev-note">
            <strong>Dev/testing only</strong> — remove before deployment:<br />
            Email: <code>{DEMO_EMAIL}</code> · Password: <code>{DEMO_PASSWORD}</code>
          </div>
        </section>
      </main>
  );
}
