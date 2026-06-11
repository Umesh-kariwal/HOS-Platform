'use client';

import React, { useEffect, useState } from 'react';

interface Checkpoint {
  id: string;
  checkpointName: string;
  completedAt: string;
}

interface AuditStatus {
  businessDate: string;
  status: string;
  totalRoomsCount: number;
  occupiedRoomsCount: number;
  occupancyRate: number;
  pendingArrivals: number;
  pendingDepartures: number;
  checkpoints: Checkpoint[];
}

export default function NightAuditPage() {
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');

  useEffect(() => {
    const customUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    setApiBaseUrl(customUrl);
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem('hos_jwt_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('hos_jwt_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(`${apiBaseUrl}/night-audit/status`, {
        headers: getHeaders(),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch operational status.');
      }

      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Error loading night audit status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiBaseUrl) {
      fetchStatus();
    }
  }, [apiBaseUrl]);

  // Run rollover
  const runRollover = async () => {
    if (!status) return;
    
    // Check if there are blocking issues
    const hasUnresolvedBookings = status.pendingArrivals > 0 || status.pendingDepartures > 0;
    if (hasUnresolvedBookings) {
      const confirmBypass = window.confirm(
        `Warning: There are ${status.pendingArrivals} pending arrivals and ${status.pendingDepartures} pending departures. Running the Night Audit will force rollover. Do you wish to proceed?`
      );
      if (!confirmBypass) return;
    }

    setRolling(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/night-audit/roll-date`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!res.ok) {
        throw new Error('Night audit rollover failed.');
      }

      const data = await res.json();
      setSuccessMsg(`Success! Rolled business date from ${data.previousDate} to ${data.newDate}.`);
      
      // Reload status
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Error executing day rollover.');
      setRolling(false);
    }
  };

  if (loading && !status) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
        <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #4f46e5', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ fontFamily: 'system-ui', color: '#6b7280' }}>Loading Night Audit Control...</div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Panel */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', color: '#111827', fontWeight: 800 }}>Night Audit & Rollover</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Reconcile daily ledgers, close current day operations, and advance the business date.</p>
      </div>

      {successMsg && (
        <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ✅ {successMsg}
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '28px', alignItems: 'start' }}>
          
          {/* Main Rollover Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Business Date Card */}
            <div style={{
              backgroundColor: '#1e2937',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '32px',
              backgroundImage: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              border: '1px solid #374151',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Decorative circle background */}
              <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }}></div>
              
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Business Date</span>
              <div style={{ fontSize: '48px', fontWeight: 900, color: '#ffffff', marginTop: '8px' }}>
                {status.businessDate}
              </div>
              <p style={{ margin: '12px 0 0 0', color: '#9ca3af', fontSize: '14px' }}>
                Property Ledger Status: <strong style={{ color: '#10b981', textTransform: 'uppercase' }}>● {status.status}</strong>
              </p>

              <button 
                onClick={runRollover}
                disabled={rolling}
                style={{
                  marginTop: '28px',
                  backgroundColor: rolling ? '#4b5563' : '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: rolling ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!rolling) e.currentTarget.style.backgroundColor = '#4f46e5';
                }}
                onMouseLeave={(e) => {
                  if (!rolling) e.currentTarget.style.backgroundColor = '#6366f1';
                }}
              >
                {rolling ? (
                  <>
                    <div style={{ border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div>
                    Processing Rollover...
                  </>
                ) : (
                  '🌙 Execute Rollover (Advance Date)'
                )}
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}} />
              </button>
            </div>

            {/* Checkpoints History Logs */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#111827', fontWeight: 'bold' }}>Previous Checkpoints History</h3>
              
              {status.checkpoints.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '14px', padding: '16px 0' }}>
                  No night audits have been performed on this branch yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {status.checkpoints.map((cp, idx) => (
                    <div 
                      key={cp.id}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px', 
                        backgroundColor: '#f9fafb', 
                        borderRadius: '8px',
                        borderLeft: idx === 0 ? '4px solid #10b981' : '1px solid #e5e7eb',
                      }}
                    >
                      <div>
                        <strong style={{ display: 'block', color: '#374151', fontSize: '14px' }}>{cp.checkpointName}</strong>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>ID: {cp.id}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(cp.completedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar / Pre-Audit Checks Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Safety Checks */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#111827', fontWeight: 'bold' }}>Pre-Audit Safety Check</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Pending check-ins check */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px' }}>
                    {status.pendingArrivals > 0 ? '❌' : '✅'}
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#374151' }}>Pending Arrivals</strong>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {status.pendingArrivals} reservations checking in today need resolution.
                    </span>
                  </div>
                </div>

                {/* Pending check-outs check */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px' }}>
                    {status.pendingDepartures > 0 ? '❌' : '✅'}
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#374151' }}>Pending Departures</strong>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {status.pendingDepartures} checked-in guests scheduled for departure today.
                    </span>
                  </div>
                </div>

                {/* Occupancy info */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px' }}>ℹ️</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#374151' }}>Occupancy Rate</strong>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {status.occupancyRate}% occupancy ({status.occupiedRoomsCount}/{status.totalRoomsCount} rooms active)
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Refresh Panel */}
            <button 
              onClick={fetchStatus}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                color: '#374151',
              }}
            >
              🔄 Refresh Operational Metrics
            </button>

          </div>

        </div>
      )}
    </div>
  );
}
