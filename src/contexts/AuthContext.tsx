import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'salon_admin' | 'staff';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  profile: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
  currentSalonId: string | null;
  currentBranchId: string | null;
  isSuperAdmin: boolean;
  isSalonAdmin: boolean;
  isStaff: boolean;
  setCurrentSalonId: (id: string | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [currentSalonId, setCurrentSalonId] = useState<string | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const fetchUserData = async (userId: string) => {
    // Fetch roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    const userRoles = (rolesData || []).map(r => r.role as AppRole);
    setRoles(userRoles);

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, phone')
      .eq('user_id', userId)
      .single();
    
    setProfile(profileData);

    // If not super_admin, fetch salon membership
    if (!userRoles.includes('super_admin')) {
      const { data: membership } = await supabase
        .from('salon_members')
        .select('salon_id, branch_id, role')
        .eq('user_id', userId)
        .limit(1)
        .single();
      
      if (membership) {
        setCurrentSalonId(membership.salon_id);
        setCurrentBranchId(membership.branch_id);
        // Also set the membership role if not already in roles
        if (!userRoles.includes(membership.role as AppRole)) {
          setRoles(prev => [...prev, membership.role as AppRole]);
        }
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRoles([]);
          setProfile(null);
          setCurrentSalonId(null);
          setCurrentBranchId(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);
    setCurrentSalonId(null);
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isSalonAdmin = roles.includes('salon_admin');
  const isStaff = roles.includes('staff');

  return (
    <AuthContext.Provider value={{
      user, session, loading, roles, profile,
      currentSalonId, currentBranchId,
      isSuperAdmin, isSalonAdmin, isStaff,
      setCurrentSalonId, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
