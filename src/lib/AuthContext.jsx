import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [isLoadingPublicSettings]             = useState(false);
  const [authError, setAuthError]             = useState(null);
  const [authChecked, setAuthChecked]         = useState(false);

  // Prevent the auth state listener from running before the initial
  // getSession() check completes (avoids a double-render race).
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
      // If the users table query fails (e.g. RLS not yet set up), fall back
      // to basic info so the app still opens.
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

    // 1. Check the existing session synchronously first.
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
        if (mounted) setAuthError({ type: 'unknown', message: e.message });
      } finally {
        if (mounted) {
          initialCheckDone.current = true;
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    };

    init();

    // 2. Listen for subsequent sign-in / sign-out / token-refresh events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Skip events that fire before the initial check is done —
        // init() already handled the opening session.
        if (!initialCheckDone.current) return;

        if (session?.user) {
          // Keep the spinner up while we load the profile.
          setIsLoadingAuth(true);
          const profile = await buildUserProfile(session.user);
          if (!mounted) return;
          setUser(profile);
          setIsAuthenticated(true);
          setAuthError(null);
          if (globalThis.db) globalThis.db.auth._cachedUser = profile;
          setIsLoadingAuth(false);
          setAuthChecked(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          if (globalThis.db) globalThis.db.auth._cachedUser = null;
          setIsLoadingAuth(false);
          setAuthChecked(true);
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
