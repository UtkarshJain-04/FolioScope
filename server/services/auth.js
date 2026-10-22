import bcrypt from 'bcryptjs';
import MongoStore from 'connect-mongo';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';

const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL
  || `http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName || user.username,
  };
}

function makeGoogleUsername(profile) {
  const googleId = String(profile.id).replace(/[^a-zA-Z0-9]/g, '');
  return `google-${googleId}`;
}

export function configurePassport() {
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return false;
  }

  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      const emailVerified = profile._json?.email_verified === true
        || profile._json?.email_verified === 'true';
      if (!email || !emailVerified) {
        return done(null, false, { message: 'Google must provide a verified email address.' });
      }

      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.findOne({ email });
        if (user) {
          user.googleId = profile.id;
          user.displayName ||= profile.displayName || '';
          await user.save();
        } else {
          user = await User.create({
            username: makeGoogleUsername(profile),
            email,
            displayName: profile.displayName || '',
            googleId: profile.id,
          });
        }
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  return true;
}

export function createSessionMiddleware({ mongoClient, sessionSecret }) {
  const store = mongoClient
    ? MongoStore.create({
      client: mongoClient,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60,
    })
    : undefined;

  return session({
    name: 'folioscope.sid',
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  });
}

export function createAuthRouter({ isDatabaseReady, hasSessionSecret, googleEnabled }) {
  const router = Router();
  const authEnabled = () => isDatabaseReady() && hasSessionSecret;
  const requireAuthConfig = (_req, res, next) => {
    if (!authEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'Authentication is not configured. Set MONGODB_URI and SESSION_SECRET on the server.',
      });
    }
    return next();
  };
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  });

  router.get('/me', (req, res) => {
    res.json({
      success: true,
      authenticated: Boolean(req.user),
      authEnabled: authEnabled(),
      googleEnabled: authEnabled() && googleEnabled,
      user: req.user ? publicUser(req.user) : null,
    });
  });

  router.post('/signup', authLimiter, requireAuthConfig, async (req, res) => {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-32 characters and use letters, numbers, dots, underscores, or hyphens.',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must be between 10 and 128 characters.' });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        username,
        email,
        passwordHash,
        displayName: username,
      });
      req.login(user, error => {
        if (error) {
          console.error('Failed to establish signup session:', error);
          return res.status(500).json({ success: false, message: 'Account created, but sign-in failed. Please sign in.' });
        }
        return res.status(201).json({ success: true, user: publicUser(user) });
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'That username or email is already registered.' });
      }
      console.error('Account signup failed:', error);
      return res.status(500).json({ success: false, message: 'Could not create your account.' });
    }
  });

  router.post('/login', authLimiter, requireAuthConfig, async (req, res) => {
    const body = req.body || {};
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
    }

    try {
      const user = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }],
      }).select('+passwordHash');
      if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
      }
      req.login(user, error => {
        if (error) {
          console.error('Failed to establish login session:', error);
          return res.status(500).json({ success: false, message: 'Could not sign you in. Please try again.' });
        }
        return res.json({ success: true, user: publicUser(user) });
      });
    } catch (error) {
      console.error('Account login failed:', error);
      return res.status(500).json({ success: false, message: 'Could not sign you in.' });
    }
  });

  router.post('/logout', (req, res, next) => {
    req.logout(error => {
      if (error) return next(error);
      if (!req.session) {
        res.clearCookie('folioscope.sid');
        return res.json({ success: true });
      }
      req.session.destroy(sessionError => {
        if (sessionError) return next(sessionError);
        res.clearCookie('folioscope.sid', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
        return res.json({ success: true });
      });
    });
  });

  router.get('/google', (req, res, next) => {
    if (!authEnabled() || !googleEnabled) {
      return res.redirect(`${CLIENT_URL}/?authError=google_not_configured`);
    }
    return passport.authenticate('google', { scope: ['profile', 'email'], state: true })(req, res, next);
  });

  router.get('/google/callback', (req, res, next) => {
    if (!authEnabled() || !googleEnabled) {
      return res.redirect(`${CLIENT_URL}/?authError=google_not_configured`);
    }
    return passport.authenticate('google', {
      failureRedirect: `${CLIENT_URL}/?authError=google_signin_failed`,
    })(req, res, () => res.redirect(`${CLIENT_URL}/?auth=success`));
  });

  router.use((error, _req, res, _next) => {
    console.error('Authentication request failed:', error);
    res.status(500).json({ success: false, message: 'Authentication request failed.' });
  });

  return router;
}

export function authenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.()) {
    return res.status(401).json({ success: false, message: 'Sign in to continue.' });
  }
  return next();
}
