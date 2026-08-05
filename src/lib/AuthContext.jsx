import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                       = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Only true during the very first session check on mount.
  // Never set back to true after that — prevents the full-screen spinner
  // from re-appearing every time the user switches tabs.
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [isLoadingPublicSettings]             = useState(false);
  const [authError, setAuthError]             = useState(null);
  const [authChecked, setAuthChecked]         = useState(false);
  const initialCheckDone = useRef(false);

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
          setUser(profile);
          setIsAuthenticated(true);
          if (globalThis.db) globalThis.db.auth._cachedUser = profile;
        }
      } catch (e) {
        console.error('Auth init error', e);
      } finally {
        if (mounted) {
          initialCheckDone.current = true;
          setIsLoadingAuth(false);   // ← only ever set false, never true again
          setAuthChecked(true);
        }
      }
    };

    init();

    // ── 2. Auth state listener ───────────────────────────────────────────────
    // Important: we NEVER set isLoadingAuth=true here.
    // State updates happen silently so the UI doesn't flash a spinner.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        // Ignore events that fire before init() completes
        if (!initialCheckDone.current) return;
        // Ignore silent token renewals — nothing visible needs to change
        if (event === 'TOKEN_REFRESHED') return;
        // Ignore INITIAL_SESSION — already handled by getSession() in init()
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_IN' && session?.user) {
          // Silently update user profile — no spinner
          const profile = await buildUserProfile(session.user);
          if (!mounted) return;
          setUser(profile);
          setIsAuthenticated(true);
          setAuthError(null);
          if (globalThis.db) globalThis.db.auth._cachedUser = profile;
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          if (globalThis.db) globalThis.db.auth._cachedUser = null;
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
    // Used by ProtectedRoute — does NOT set isLoadingAuth to avoid spinner flash
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
