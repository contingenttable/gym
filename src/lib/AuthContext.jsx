import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                       = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [isLoadingPublicSettings]             = useState(false);
  const [authError, setAuthError]             = useState(null);
  const [authChecked, setAuthChecked]         = useState(false);
  const initialCheckDone = useRef(false);
  // Timestamp of the last profile build — avoid redundant DB hits
  const lastProfileBuild = useRef(0);

  const buildUserProfile = async (supabaseUser) => {
    if (!supabaseUser) return null;
    try {
      const { data } = await supabase
        .from('users').select('*').eq('id', supabaseUser.id).maybeSingle();
      return {
        id:        supabaseUser.id,
        email:     supabaseUser.email,
        full_name: data?.full_name || supabaseUser.user_metadata?.full_name || '',
        role:      data?.role || 'reception',
        ...(data || {}),
      };
    } catch {
      return {
        id:        supabaseUser.id,
        email:     supabaseUser.email,
        full_name: supabaseUser.user_metadata?.full_name || '',
        role:      'reception',
      };
    }
  };

  useEffect(() => {
    let mounted = true;

    // ── 1. One-time session check on mount ───────────────────────────────────
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          const profile = await buildUserProfile(session.user);
          if (!mounted) return;
          lastProfileBuild.current = Date.now();
          setUser(profile);
          setIsAuthenticated(true);
          if (globalThis.db) globalThis.db.auth._cachedUser = profile;
        }
      } catch (e) {
        console.error('Auth init error', e);
      } finally {
        if (mounted) {
          initialCheckDone.current = true;
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    };

    init();

    // ── 2. Auth state listener ───────────────────────────────────────────────
    // CRITICAL: We NEVER trigger a full re-render / spinner from this listener.
    // The ONLY events we care about after init are:
    //   SIGNED_IN  — user just logged in from the login page
    //   SIGNED_OUT — user logged out
    // Everything else (TOKEN_REFRESHED, INITIAL_SESSION, MFA_CHALLENGE_VERIFIED,
    // PASSWORD_RECOVERY) is ignored — they don't change what the UI shows.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (!initialCheckDone.current) return;

        // Ignore all silent background events
        if (event === 'TOKEN_REFRESHED')         return;
        if (event === 'INITIAL_SESSION')          return;
        if (event === 'MFA_CHALLENGE_VERIFIED')   return;
        if (event === 'PASSWORD_RECOVERY')        return;
        if (event === 'USER_UPDATED')             return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          if (globalThis.db) globalThis.db.auth._cachedUser = null;
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Debounce: if we built the profile within the last 30 seconds,
          // skip — this is likely a token refresh triggering a SIGNED_IN.
          const now = Date.now();
          if (now - lastProfileBuild.current < 30000) return;
          lastProfileBuild.current = now;

          // Build silently — NO spinner, NO isLoadingAuth change
          const profile = await buildUserProfile(session.user);
          if (!mounted) return;
          setUser(profile);
          setIsAuthenticated(true);
          setAuthError(null);
          if (globalThis.db) globalThis.db.auth._cachedUser = profile;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  const checkUserAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await buildUserProfile(session.user);
        setUser(profile);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('checkUserAuth error', e);
    } finally {
      setAuthChecked(true);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
      authError, authChecked, appPublicSettings: null,
      logout, navigateToLogin, checkUserAuth, checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
