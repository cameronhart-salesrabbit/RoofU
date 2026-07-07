import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRole(authUserId) {
      if (!authUserId) { setIsAdmin(false); setLoading(false); return; }
      const { data } = await supabase.from('users').select('role').eq('auth_id', authUserId).single();
      setIsAdmin(data?.role === 'admin');
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

    const { data: user } = await supabase.from('users').select('role').eq('auth_id', data.user.id).single();
    if (user?.role !== 'admin') {
      await supabase.auth.signOut();
      return { success: false, message: 'Your account does not have admin access.' };
    }

    setIsAdmin(true);
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AdminAuthContext.Provider value={{ isAdmin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
