import React, { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'parent' | 'staff' | 'admin' | 'business';
  } | null;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isBusinessRoute = location.pathname.startsWith('/business');
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header key="main-header" user={user} onLogout={onLogout} />
      <main className="flex-grow">
        {children}
      </main>
      {!isAdminRoute && !isBusinessRoute && <Footer key="main-footer" />}
    </div>
  );
};

export default Layout;
