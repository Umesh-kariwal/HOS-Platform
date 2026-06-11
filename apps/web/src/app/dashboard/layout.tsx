'use client';

import React, { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('hos_jwt_token');
    if (!token) {
      window.location.href = '/login';
    } else {
      setAuthorized(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('hos_jwt_token');
    window.location.href = '/login';
  };

  if (!authorized) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f9fafb' }}>
      {/* Sidebar */}
      <div style={{ width: '260px', backgroundColor: '#1f2937', color: '#ffffff', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
        <h2 style={{ margin: '0 0 32px 0', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>HOS Control Center</h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          <a href="/dashboard/grid" style={{ color: '#d1d5db', textDecoration: 'none', padding: '12px 16px', borderRadius: '6px', backgroundColor: 'transparent', transition: 'background-color 0.2s' }}
             onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
             onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            📅 Room Grid Timeline
          </a>
          <a href="/dashboard/housekeeping" style={{ color: '#d1d5db', textDecoration: 'none', padding: '12px 16px', borderRadius: '6px', backgroundColor: 'transparent', transition: 'background-color 0.2s' }}
             onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
             onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            🧹 Housekeeping
          </a>
          <a href="/dashboard/night-audit" style={{ color: '#d1d5db', textDecoration: 'none', padding: '12px 16px', borderRadius: '6px', backgroundColor: 'transparent', transition: 'background-color 0.2s' }}
             onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
             onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            🌙 Night Audit
          </a>
        </nav>

        <button onClick={handleLogout} style={{ border: 'none', backgroundColor: '#ef4444', color: '#ffffff', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
          Sign Out
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '32px' }}>
        {children}
      </div>
    </div>
  );
}
