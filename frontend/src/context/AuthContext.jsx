import React, { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentMember, setCurrentMember] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const login = useCallback((member) => {
    setCurrentMember(member);
    setIsAdmin(member.designation === 'Admin');
    localStorage.setItem('currentMember', JSON.stringify(member));
    localStorage.setItem('isAdmin', isAdmin);
  }, [isAdmin]);

  const logout = useCallback(() => {
    setCurrentMember(null);
    setIsAdmin(false);
    localStorage.removeItem('currentMember');
    localStorage.removeItem('isAdmin');
  }, []);

  return (
    <AuthContext.Provider value={{ currentMember, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
