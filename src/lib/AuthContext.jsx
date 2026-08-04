import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                             = useState(null);
  const [isAuthenticated, setIsAuthenticated]       = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]           = useState(true);
  // kept for API compat with pages that read these flags
  const [isLoadingPublicSettings]                   = useState(false);
  const [authError, setAuthError]                   = useState(null);
  const [authChecked, setAuthChecked]               = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────────

  const buildUserProfile = async (supabaseUser) => {
    if (!supabaseUser) return null;
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

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

  // ── initial session check ─────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const profile = await buildUserProfile(session.user);
          setUser(profile);
          setIsAuthenticated(true);
          // expose on globalThis so gym.js utility functions can call db.auth.me()
          globalThis.db && (globalThis.db.auth._cachedUser = profile);
        }
      } catch (e) {
        console.error('Auth init error', e);
        if (mounted) {
          setAuthError({ type: 'unknown', message: e.message });
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    };

    init();

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const profile = await buildUserProfile(session.user);
          setUser(profile);
          setIsAuthenticated(true);
          setAuthError(null);
          globalThis.db && (globalThis.db.auth._cachedUser = profile);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          globalThis.db && (globalThis.db.auth._cachedUser = null);
        }
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── auth actions ──────────────────────────────────────────────────────────────

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
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
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
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
