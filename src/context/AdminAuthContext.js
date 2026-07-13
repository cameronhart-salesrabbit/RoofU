import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

const ADMIN_ROLES = ['admin', 'super_admin'];

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRole(authUserId) {
      if (!authUserId) {
        setIsAdmin(false); setIsSuperAdmin(false); setRole(null); setClientId(null); setLoading(false);
        return;
      }
      const { data } = await supabase.from('users').select('role, client_id').eq('auth_id', authUserId).single();
      setIsAdmin(ADMIN_ROLES.includes(data?.role));
      setIsSuperAdmin(data?.role === 'super_admin');
      setRole(data?.role || null);
      setClientId(data?.client_id || null);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      checkRole(data.session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      checkRole(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: 'Incorrect email or password.' };

    const { data: user } = await supabase.from('users').select('role, client_id').eq('auth_id', data.user.id).single();
    if (!ADMIN_ROLES.includes(user?.role)) {
      await supabase.auth.signOut();
      return { success: false, message: 'Your account does not have admin access.' };
    }

    setIsAdmin(true);
    setIsSuperAdmin(user.role === 'super_admin');
    setRole(user.role);
    setClientId(user.client_id || null);
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setRole(null);
    setClientId(null);
    setSelectedClientId(null);
  };

  // A super-admin manages whichever client they've picked in the client
  // switcher; a normal admin always manages their own client. This is what
  // the rest of the app should use for reads/writes, not `clientId` directly.
  const effectiveClientId = isSuperAdmin ? selectedClientId : clientId;

  return (
    <AdminAuthContext.Provider value={{
      isAdmin, isSuperAdmin, role, clientId,
      selectedClientId, setSelectedClientId, effectiveClientId,
      loading, login, logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
