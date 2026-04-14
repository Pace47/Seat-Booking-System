import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { MemberDashboard } from './components/MemberDashboard';
import { BookingCalendar } from './components/BookingCalendar';
import { AdminPanel } from './components/AdminPanel';
import './styles/App.css';

function AppContent() {
  const { currentMember, isAdmin, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentView, setCurrentView] = useState('dashboard');

  if (!currentMember) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>🏢 Seat Booking System</h1>
        </div>
        <div className="header-right">
          <span className="member-name">{currentMember.name}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      {isAdmin && (
        <nav className="admin-nav">
          <button 
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-btn ${currentView === 'booking' ? 'active' : ''}`}
            onClick={() => setCurrentView('booking')}
          >
            Book Seat
          </button>
          <button 
            className={`nav-btn ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentView('admin')}
          >
            Admin Panel
          </button>
        </nav>
      )}

      <main className="app-main">
        {currentView === 'dashboard' && (
          <MemberDashboard 
            member={currentMember} 
            onRefresh={() => setRefreshKey(prev => prev + 1)}
            key={refreshKey}
          />
        )}

        {currentView === 'booking' && (
          <BookingCalendar 
            member={currentMember}
            onBookingSuccess={() => setRefreshKey(prev => prev + 1)}
          />
        )}

        {currentView === 'admin' && isAdmin && (
          <AdminPanel />
        )}

        {currentView === 'dashboard' && (
          <BookingCalendar 
            member={currentMember}
            onBookingSuccess={() => setRefreshKey(prev => prev + 1)}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
