'use client';

import React, { useEffect, useState } from 'react';

interface MaintenanceTicket {
  id: string;
  roomId: string | null;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'general';
  assignedEmployeeId: string | null;
  loggedById: string;
  completionNotes: string | null;
  completedAt: string | null;
  createdAt: string;
  room: {
    id: string;
    roomNumber: string;
  } | null;
  assignedEmployee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  loggedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface Room {
  id: string;
  roomNumber: string;
  physicalStatus: string;
}

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');

  // Filter state
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterRoom, setFilterRoom] = useState('all');

  // Form inputs
  const [newRoomId, setNewRoomId] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newCategory, setNewCategory] = useState('general');
  const [newAssignedId, setNewAssignedId] = useState('');

  // Complete Dialog state
  const [completingTicketId, setCompletingTicketId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');

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
    setLoading(true);
    try {
      const headers = getHeaders();
      const [ticketsRes, roomsRes, staffRes] = await Promise.all([
        fetch(`${apiBaseUrl}/maintenance`, { headers }),
        fetch(`${apiBaseUrl}/rooms`, { headers }),
        fetch(`${apiBaseUrl}/maintenance/staff`, { headers }),
      ]);

      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      if (roomsRes.ok) setRooms(await roomsRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
    } catch (err: any) {
      setError('Failed to fetch maintenance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, apiBaseUrl]);

  // Log Ticket
  const handleLogTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;

    try {
      const res = await fetch(`${apiBaseUrl}/maintenance`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          roomId: newRoomId || undefined,
          description: newDesc,
          priority: newPriority,
          category: newCategory,
          assignedEmployeeId: newAssignedId || undefined,
        }),
      });

      if (res.ok) {
        setNewRoomId('');
        setNewDesc('');
        setNewPriority('medium');
        setNewCategory('general');
        setNewAssignedId('');
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error logging ticket');
      }
    } catch (err) {
      alert('Error creating maintenance ticket');
    }
  };

  // Assign Ticket
  const handleAssign = async (ticketId: string, empId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/maintenance/${ticketId}/assign`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ assignedEmployeeId: empId }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error assigning ticket');
      }
    } catch (err) {
      alert('Error assigning ticket');
    }
  };

  // Complete Ticket
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTicketId || !completionNotes.trim()) return;

    try {
      const res = await fetch(`${apiBaseUrl}/maintenance/${completingTicketId}/complete`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ completionNotes }),
      });

      if (res.ok) {
        setCompletingTicketId(null);
        setCompletionNotes('');
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error completing ticket');
      }
    } catch (err) {
      alert('Error completing ticket');
    }
  };

  // Cancel Ticket
  const handleCancel = async (ticketId: string) => {
    if (!confirm('Are you sure you want to cancel this maintenance ticket?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/maintenance/${ticketId}/cancel`, {
        method: 'PATCH',
        headers: getHeaders(),
      });

      if (res.ok) {
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error cancelling ticket');
      }
    } catch (err) {
      alert('Error cancelling ticket');
    }
  };

  // Metrics
  const openCount = tickets.filter(t => t.status === 'open').length;
  const progressCount = tickets.filter(t => t.status === 'in_progress').length;
  const completedCount = tickets.filter(t => t.status === 'completed').length;
  const criticalCount = tickets.filter(t => t.priority === 'critical' && t.status !== 'completed' && t.status !== 'cancelled').length;

  // Filters
  const filteredTickets = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchRoom = filterRoom === 'all' || t.roomId === filterRoom;
    return matchStatus && matchPriority && matchRoom;
  });

  const priorityColors = {
    low: { bg: '#f3f4f6', text: '#374151' },
    medium: { bg: '#eff6ff', text: '#1e40af' },
    high: { bg: '#fff7ed', text: '#c2410c' },
    critical: { bg: '#fef2f2', text: '#991b1b' },
  };

  const statusColors = {
    open: { bg: '#fef3c7', text: '#92400e' },
    in_progress: { bg: '#eff6ff', text: '#1e40af' },
    completed: { bg: '#ecfdf5', text: '#065f46' },
    cancelled: { bg: '#f3f4f6', text: '#374151' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#f9fafb' }}>
        <div style={{ fontFamily: 'system-ui', color: '#6b7280' }}>Loading Maintenance Console...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', color: '#111827', fontWeight: 800, margin: '0 0 4px 0' }}>Maintenance & Preventive Care</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Create, assign, and track maintenance tickets across property rooms and assets</p>
      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          Error: {error}
        </div>
      )}

      {/* Metrics Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Open Tickets</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{openCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>In Progress</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{progressCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Critical Blocker Issues</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{criticalCount}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Resolved (Total)</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{completedCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        {/* Main Ticket list and filters */}
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
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select 
              value={filterPriority} 
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '13px' }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select 
              value={filterRoom} 
              onChange={(e) => setFilterRoom(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '13px' }}
            >
              <option value="all">All Rooms</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
              ))}
            </select>

            <button 
              onClick={fetchData}
              style={{ marginLeft: 'auto', padding: '6px 14px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#374151' }}
            >
              Refresh
            </button>
          </div>

          {/* Tickets Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Ticket Info</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Location / Cat</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Priority / Status</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>Assignment</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>No maintenance tickets match the filter parameters.</td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => {
                    const dateStr = new Date(t.createdAt).toLocaleString();
                    const priorityStyle = priorityColors[t.priority] || priorityColors.medium;
                    const statusStyle = statusColors[t.status] || statusColors.open;
                    const isClosed = ['completed', 'cancelled'].includes(t.status);

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 'bold', color: '#111827' }}>{t.description}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Logged on: {dateStr}</div>
                          {t.completionNotes && (
                            <div style={{ fontSize: '12px', color: '#059669', marginTop: '6px', fontStyle: 'italic', backgroundColor: '#f0fdf4', padding: '6px', borderRadius: '4px' }}>
                              Fix notes: {t.completionNotes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: '500' }}>{t.room ? `Room ${t.room.roomNumber}` : 'General Asset'}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize', marginTop: '2px' }}>{t.category}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginRight: '6px', backgroundColor: priorityStyle.bg, color: priorityStyle.text }}>
                            {t.priority}
                          </div>
                          <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                            {t.status.replace('_', ' ')}
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          {t.assignedEmployee ? (
                            <div style={{ color: '#111827', fontWeight: '500' }}>
                              {t.assignedEmployee.firstName} {t.assignedEmployee.lastName}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                          {!isClosed && (
                            <select
                              value={t.assignedEmployeeId || ''}
                              onChange={(e) => handleAssign(t.id, e.target.value)}
                              style={{ display: 'block', width: '130px', marginTop: '6px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                            >
                              <option value="">-- Assign Staff --</option>
                              {staff.map(s => (
                                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {!isClosed && (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setCompletingTicketId(t.id)}
                                style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => handleCancel(t.id)}
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

        {/* Sidebar Log Ticket Panel */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>Log Maintenance</h2>
          
          <form onSubmit={handleLogTicket} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Associated Room (Optional)</label>
              <select
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '100%' }}
              >
                <option value="">-- No Room (General Asset) --</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Issue Details</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="E.g. Leaking sink, AC blowing warm air, broken table leg..."
                required
                rows={3}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="general">General</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="hvac">HVAC / AC</option>
                <option value="furniture">Furniture</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Severity / Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="low">Low (Minor fix)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="high">High (Urgent)</option>
                <option value="critical">Critical (Blocks room sales)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Initial Assignee (Optional)</label>
              <select
                value={newAssignedId}
                onChange={(e) => setNewAssignedId(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="">-- Unassigned --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
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
              Log Maintenance Issue
            </button>
          </form>
        </div>

      </div>

      {/* Resolve Dialog Modal */}
      {completingTicketId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>Complete Maintenance Ticket</h3>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 16px 0' }}>Log what was done to fix the issue. Completing this will restore the room to clean physical status if no other active issues remain.</p>
            
            <form onSubmit={handleComplete}>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="E.g. Repaired broken toilet flush valve, tested and verified leak resolved."
                required
                rows={4}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setCompletingTicketId(null)}
                  style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                >
                  Save & Resolve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
