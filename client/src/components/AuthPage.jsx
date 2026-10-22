import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import './AuthPage.css';

export default function AuthPage({
  authEnabled,
  googleEnabled,
  initialMessage = '',
  onAuthenticated,
}) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'signup'
          ? { username, email, password }
          : { identifier: username, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not authenticate. Please try again.');
      }
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.assign('/api/auth/google');
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand-mark"><ShieldCheck size={23} /></div>
        <span className="auth-kicker">FOLIOSCOPE ACCOUNT</span>
        <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-intro">
          Sign in to explore your portfolio analysis workspace and keep saved portfolios private to your account.
        </p>

        {!authEnabled && (
          <div className="auth-message auth-message-warning" role="status">
            Sign-in is not configured yet. The server needs a reachable MongoDB database and a `SESSION_SECRET` of at least 32 characters.
          </div>
        )}
        {error && <div className="auth-message auth-message-error" role="alert">{error}</div>}

        <button
          type="button"
          className="auth-google-button"
          onClick={handleGoogleSignIn}
          disabled={!authEnabled || !googleEnabled || isSubmitting}
        >
          <span className="auth-google-g">G</span>
          Continue with Google
        </button>
        {!googleEnabled && authEnabled && (
          <p className="auth-provider-note">Google sign-in requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server.</p>
        )}

        <div className="auth-divider"><span>or use your account</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label htmlFor="auth-username">Username</label>
              <div className="auth-input-wrap">
                <UserRound size={17} />
                <input
                  id="auth-username"
                  autoComplete="username"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9_.-]{3,32}"
                  required
                  disabled={!authEnabled}
                  placeholder="Choose a username"
                />
              </div>
            </>
          )}

          <label htmlFor="auth-identifier">{mode === 'signup' ? 'Email address' : 'Username or email'}</label>
          <div className="auth-input-wrap">
            <UserRound size={17} />
            <input
              id="auth-identifier"
              type={mode === 'signup' ? 'email' : 'text'}
              autoComplete={mode === 'signup' ? 'email' : 'username'}
              value={mode === 'signup' ? email : username}
              onChange={event => mode === 'signup' ? setEmail(event.target.value) : setUsername(event.target.value)}
              required
              disabled={!authEnabled}
              placeholder={mode === 'signup' ? 'you@example.com' : 'Your username or email'}
            />
          </div>

          <label htmlFor="auth-password">Password</label>
          <div className="auth-input-wrap">
            <LockKeyhole size={17} />
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={mode === 'signup' ? 10 : undefined}
              maxLength={128}
              required
              disabled={!authEnabled}
              placeholder={mode === 'signup' ? 'At least 10 characters' : 'Enter your password'}
            />
          </div>

          <button className="auth-submit-button" type="submit" disabled={!authEnabled || isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            {!isSubmitting && <ArrowRight size={17} />}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signup' ? 'Already have an account?' : 'New to FolioScope?'}
          <button
            type="button"
            onClick={() => {
              setError('');
              setMode(mode === 'signup' ? 'login' : 'signup');
            }}
          >
            {mode === 'signup' ? 'Sign in' : 'Create account'}
          </button>
        </p>

        <p className="auth-privacy-note">
          <ShieldCheck size={14} />
          Passwords are hashed before storage. Sessions use HttpOnly cookies.
        </p>
      </section>
    </main>
  );
}
