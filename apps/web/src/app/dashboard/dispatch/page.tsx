'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Room {
  id: string;
  roomNumber: string;
}

interface Booking {
  id: string;
  guest: Guest;
  room: Room | null;
  status: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface ServiceRequest {
  id: string;
  bookingId: string;
  requestType: string;
  details: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  assignedEmployeeId: string | null;
  createdAt: string;
  booking: Booking;
  assignedEmployee: Employee | null;
}

export default function DispatchPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Form inputs
  const [newBookingId, setNewBookingId] = useState('');
  const [newType, setNewType] = useState('towels');
  const [newDetails, setNewDetails] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('hos_jwt_token') || '';
    setToken(storedToken);

    const customUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    setApiBaseUrl(customUrl);
  }, []);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchData = async () => {
    if (!token || !apiBaseUrl) return;
    try {
      const headers = getHeaders();
      const [reqsRes, bookingsRes, employeesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/dispatch`, { headers }),
        fetch(`${apiBaseUrl}/bookings`, { headers }), // to find checked-in guests
        fetch(`${apiBaseUrl}/maintenance/staff`, { headers }), // reuse staff list endpoint
      ]);

      if (reqsRes.ok) setRequests(await reqsRes.ok ? await reqsRes.json() : []);
      if (bookingsRes.ok) {
        const allBookings = await bookingsRes.json();
        // Only show checked-in bookings for request dispatching
        setBookings(allBookings.filter((b: any) => b.status === 'checked_in'));
      }
      if (employeesRes.ok) setEmployees(await employeesRes.json());
    } catch (err: any) {
      setError('Failed to fetch guest service requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let socket: any = null;
    if (token && apiBaseUrl) {
      fetchData();

      // Establish WebSocket Client Connection for Real-Time Dispatch Alerts
      const wsUrl = apiBaseUrl.replace('/api/v1', '/dispatch');
      console.log('[WS-GSR] Connecting to:', wsUrl);
      socket = io(wsUrl, {
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('connect', () => {
        console.log('[WS-GSR] Connected successfully.');
      });

      socket.on('service_request_created', (data: any) => {
        console.log('[WS-GSR] Request Created:', data);
        setRequests(prev => [data, ...prev]);
      });

      socket.on('service_request_updated', (data: any) => {
        console.log('[WS-GSR] Request Updated:', data);
        setRequests(prev => prev.map(r => r.id === data.id ? data : r));
      });
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [token, apiBaseUrl]);

  // Log new guest request
  const handleLogRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookingId) return;

    try {
      const res = await fetch(`${apiBaseUrl}/dispatch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          bookingId: newBookingId,
          requestType: newType,
          details: newDetails || undefined,
          assignedEmployeeId: newAssigneeId || undefined,
        }),
      });

      if (res.ok) {
        setNewBookingId('');
        setNewType('towels');
        setNewDetails('');
        setNewAssigneeId('');
        // No need to manually call fetchData because WebSocket broadcast will append the request
      } else {
        const err = await res.json();
        alert(err.message || 'Error logging request');
      }
    } catch (err) {
      alert('Error creating request');
    }
  };

  // Assign staff
  const handleAssign = async (requestId: string, employeeId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/dispatch/${requestId}/assign`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ assignedEmployeeId: employeeId }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Error assigning employee');
      }
    } catch (err) {
      alert('Error assigning employee');
    }
  };

  // Complete request
  const handleComplete = async (requestId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/dispatch/${requestId}/complete`, {
        method: 'PATCH',
        headers: getHeaders(),
      });

      if (!res.ok) {
        alert('Error completing request');
      }
    } catch (err) {
      alert('Error completing request');
    }
  };

  // Cancel request
  const handleCancel = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/dispatch/${requestId}/cancel`, {
        method: 'PATCH',
        headers: getHeaders(),
      });

      if (!res.ok) {
        alert('Error cancelling request');
      }
    } catch (err) {
      alert('Error cancelling request');
    }
  };

  // Counts
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const assignedCount = requests.filter(r => r.status === 'assigned').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  const filteredRequests = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchType = filterType === 'all' || r.requestType === filterType;
    return matchStatus && matchType;
  });

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#fef3c7', text: '#92400e' },
    assigned: { bg: '#eff6ff', text: '#1e40af' },
    completed: { bg: '#ecfdf5', text: '#065f46' },
    cancelled: { bg: '#f3f4f6', text: '#374151' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#f9fafb' }}>
        <div style={{ fontFamily: 'system-ui', color: '#6b7280' }}>Loading Dispatch Console...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', color: '#111827', fontWeight: 800, margin: '0 0 4px 0' }}>Guest Service Dispatch</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Dispatch, assign, and track live guest requests and amenities delivery</p>
      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          Error: {error}
        </div>
      )}

      {/* Metrics Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Pending Requests</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>In Progress / Assigned</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{assignedCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Completed (Session)</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{completedCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Requests List */}
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', backgroundColor: '#f3f4f6', padding: '12px 16px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Filters:</span>
            
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '13px' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '13px' }}
            >
              <option value="all">All Request Types</option>
              <option value="towels">Towels</option>
              <option value="water">Water / Beverage</option>
              <option value="toiletries">Toiletries</option>
              <option value="extra_bed">Extra Bed / Linen</option>
              <option value="other">Other / Special request</option>
            </select>

            <button 
              onClick={fetchData}
              style={{ marginLeft: 'auto', padding: '6px 14px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#374151' }}
            >
              Refresh
            </button>
          </div>

          {/* Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Guest & Room</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Request Type</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Details</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Assignee & Status</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>No service requests logged.</td>
                  </tr>
                ) : (
                  filteredRequests.map((r) => {
                    const statusStyle = statusColors[r.status] || statusColors.pending;
                    const isClosed = ['completed', 'cancelled'].includes(r.status);

                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 'bold', color: '#111827' }}>
                            {r.booking.guest.firstName} {r.booking.guest.lastName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            Room {r.booking.room?.roomNumber || 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>
                            {r.requestType.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '16px', color: '#4b5563' }}>
                          {r.details || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>None</span>}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                            {r.status}
                          </div>
                          {r.assignedEmployee ? (
                            <div style={{ fontSize: '12px', color: '#111827', fontWeight: '500' }}>
                              {r.assignedEmployee.firstName} {r.assignedEmployee.lastName}
                            </div>
                          ) : (
                            !isClosed && (
                              <select
                                value={r.assignedEmployeeId || ''}
                                onChange={(e) => handleAssign(r.id, e.target.value)}
                                style={{ display: 'block', width: '130px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}
                              >
                                <option value="">-- Assign Staff --</option>
                                {employees.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                                ))}
                              </select>
                            )
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {!isClosed && (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleComplete(r.id)}
                                style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => handleCancel(r.id)}
                                style={{ padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#dc2626', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Log Request Form */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>Dispatch Request</h2>
          
          <form onSubmit={handleLogRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>In-House Guest / Room</label>
              <select
                value={newBookingId}
                onChange={(e) => setNewBookingId(e.target.value)}
                required
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '100%' }}
              >
                <option value="">-- Select Checked-In Guest --</option>
                {bookings.map(b => (
                  <option key={b.id} value={b.id}>
                    Room {b.room?.roomNumber || 'N/A'} - {b.guest.firstName} {b.guest.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Request Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="towels">Towels</option>
                <option value="water">Water / Beverage</option>
                <option value="toiletries">Toiletries</option>
                <option value="extra_bed">Extra Bed / Linen</option>
                <option value="other">Other / Special</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Details / Remarks</label>
              <textarea
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                placeholder="E.g. Wants 2 extra sets of towels, extra pillow..."
                rows={3}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Assignee (Optional)</label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="">-- Unassigned --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
            >
              Dispatch Request
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
