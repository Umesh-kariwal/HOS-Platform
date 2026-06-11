'use client';

import React, { useEffect, useState } from 'react';

interface Room {
  id: string;
  roomNumber: string;
  physicalStatus: 'clean' | 'dirty';
  occupancyStatus: 'vacant' | 'occupied';
  roomType: {
    id: string;
    code: string;
    name: string;
    rackRate: number;
  };
  floor: {
    name: string;
    floorNumber: number;
  };
}

interface Booking {
  id: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: 'reserved' | 'checked_in' | 'checked_out';
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function RoomGridPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [businessDateStr, setBusinessDateStr] = useState('2026-06-11');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    guestFirstName: '',
    guestLastName: '',
    guestEmail: '',
    checkInDate: '',
    checkOutDate: '',
    roomId: '',
  });

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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('hos_jwt_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      // Fetch business date
      const statusRes = await fetch(`${apiBaseUrl}/night-audit/status`, {
        headers: getHeaders(),
      });
      if (!statusRes.ok) throw new Error('Failed to fetch business date status.');
      const statusData = await statusRes.json();
      setBusinessDateStr(statusData.businessDate);

      // Fetch rooms
      const roomsRes = await fetch(`${apiBaseUrl}/rooms`, {
        headers: getHeaders(),
      });
      if (!roomsRes.ok) throw new Error('Failed to fetch rooms list.');
      const roomsData = await roomsRes.json();
      setRooms(roomsData);

      // Fetch bookings
      const bookingsRes = await fetch(`${apiBaseUrl}/bookings`, {
        headers: getHeaders(),
      });
      if (!bookingsRes.ok) throw new Error('Failed to fetch bookings list.');
      const bookingsData = await bookingsRes.json();
      setBookings(bookingsData);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiBaseUrl) {
      fetchData();
    }
  }, [apiBaseUrl]);

  // Generate 10 days starting from the business date
  const timelineDates: Date[] = [];
  const baseDate = new Date(businessDateStr);
  for (let i = 0; i < 10; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    timelineDates.push(d);
  }

  // Format date helper (YYYY-MM-DD)
  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Find booking for a specific room and date
  const getBookingForCell = (roomId: string, date: Date) => {
    const dateStr = formatDateKey(date);
    return bookings.find(b => {
      if (b.roomId !== roomId) return false;
      const checkInStr = b.checkInDate.split('T')[0];
      const checkOutStr = b.checkOutDate.split('T')[0];
      return dateStr >= checkInStr && dateStr < checkOutStr;
    });
  };

  // Check-in action
  const handleCheckIn = async (bookingId: string, roomId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/bookings/${bookingId}/check-in`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ roomId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Check-in failed.');
      }
      setSelectedBooking(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Check-out action
  const handleCheckOut = async (bookingId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/bookings/${bookingId}/check-out`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Check-out failed.');
      }
      setSelectedBooking(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create booking submit
  const handleCreateBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBaseUrl}/bookings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          guestFirstName: formData.guestFirstName,
          guestLastName: formData.guestLastName,
          guestEmail: formData.guestEmail,
          checkInDate: formData.checkInDate,
          checkOutDate: formData.checkOutDate,
          roomId: formData.roomId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to create booking.');
      }

      setShowCreateModal(false);
      setFormData({
        guestFirstName: '',
        guestLastName: '',
        guestEmail: '',
        checkInDate: '',
        checkOutDate: '',
        roomId: '',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
        <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #4f46e5', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ fontFamily: 'system-ui', color: '#6b7280' }}>Syncing Room Grid...</div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', color: '#111827', fontWeight: 800 }}>Room Grid Timeline</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Current Business Date: <strong style={{ color: '#4f46e5', backgroundColor: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>{businessDateStr}</strong>
          </p>
        </div>
        
        <button 
          onClick={() => {
            setFormData(prev => ({ ...prev, checkInDate: businessDateStr }));
            setShowCreateModal(true);
          }}
          style={{
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
            transition: 'background-color 0.2s, transform 0.1s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          ➕ Create Reservation
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Grid Container */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        
        {/* Horizontal Calendar Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(10, 1fr)', borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <div style={{ padding: '16px', fontWeight: 'bold', color: '#374151', borderRight: '1px solid #e5e7eb' }}>
            Rooms & Status
          </div>
          {timelineDates.map((date, idx) => {
            const isToday = formatDateKey(date) === businessDateStr;
            return (
              <div 
                key={idx} 
                style={{ 
                  padding: '10px 4px', 
                  textAlign: 'center', 
                  borderRight: idx < 9 ? '1px solid #e5e7eb' : 'none',
                  backgroundColor: isToday ? '#e0e7ff' : 'transparent',
                }}
              >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: isToday ? '#4f46e5' : '#6b7280', fontWeight: isToday ? 'bold' : 'normal' }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isToday ? '#1e1b4b' : '#111827' }}>
                  {date.getDate()}
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Room Rows */}
        {rooms.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            No rooms found. Run the seed script to setup pilot hotel properties.
          </div>
        ) : (
          rooms.map((room) => {
            return (
              <div 
                key={room.id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '180px repeat(10, 1fr)', 
                  borderBottom: '1px solid #e5e7eb',
                  alignItems: 'stretch',
                }}
              >
                {/* Room Metadata Column */}
                <div style={{ padding: '14px 16px', borderRight: '1px solid #e5e7eb', backgroundColor: '#fcfcfd', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '16px' }}>Room {room.roomNumber}</span>
                    <span style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>
                      {room.roomType.code}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Clean / Dirty Badge */}
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      fontWeight: 'bold',
                      color: room.physicalStatus === 'clean' ? '#065f46' : '#92400e',
                      backgroundColor: room.physicalStatus === 'clean' ? '#d1fae5' : '#fef3c7'
                    }}>
                      {room.physicalStatus}
                    </span>
                    {/* Occupancy Status Badge */}
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      fontWeight: 'bold',
                      color: room.occupancyStatus === 'occupied' ? '#1e40af' : '#374151',
                      backgroundColor: room.occupancyStatus === 'occupied' ? '#dbeafe' : '#f3f4f6'
                    }}>
                      {room.occupancyStatus}
                    </span>
                  </div>
                </div>

                {/* Timeline cells */}
                {timelineDates.map((date, idx) => {
                  const booking = getBookingForCell(room.id, date);
                  const isCheckInCell = booking && booking.checkInDate.split('T')[0] === formatDateKey(date);

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        borderRight: idx < 9 ? '1px solid #f3f4f6' : 'none',
                        position: 'relative',
                        minHeight: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: idx % 2 === 0 ? '#fafafa' : '#ffffff',
                      }}
                    >
                      {booking && (
                        <div 
                          onClick={() => setSelectedBooking(booking)}
                          style={{
                            position: 'absolute',
                            left: '4px',
                            right: '4px',
                            top: '6px',
                            bottom: '6px',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            zIndex: 10,
                            // Sophisticated colors based on booking status
                            backgroundColor: booking.status === 'checked_in' ? '#eff6ff' : booking.status === 'checked_out' ? '#f3f4f6' : '#e0e7ff',
                            color: booking.status === 'checked_in' ? '#1e40af' : booking.status === 'checked_out' ? '#374151' : '#4338ca',
                            border: booking.status === 'checked_in' ? '1px solid #3b82f6' : booking.status === 'checked_out' ? '1px solid #d1d5db' : '1px solid #6366f1',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'transform 0.1s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {isCheckInCell ? (
                            <>
                              <span style={{ fontWeight: 'bold' }}>👤 {booking.guest.lastName}</span>
                              <span style={{ fontSize: '9px', opacity: 0.8 }}>
                                {booking.status === 'checked_in' ? '● In' : booking.status === 'checked_out' ? '○ Out' : '⏱ Reserved'}
                              </span>
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9px' }}>⇄</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            width: '450px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>Reservation Detail</h3>
              <button 
                onClick={() => setSelectedBooking(null)}
                style={{ border: 'none', backgroundColor: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Guest Name</span>
                <strong style={{ color: '#111827', fontSize: '16px' }}>{selectedBooking.guest.firstName} {selectedBooking.guest.lastName}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Email</span>
                <span style={{ color: '#374151' }}>{selectedBooking.guest.email}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Check In</span>
                  <span style={{ color: '#374151', fontWeight: 'bold' }}>{selectedBooking.checkInDate.split('T')[0]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Check Out</span>
                  <span style={{ color: '#374151', fontWeight: 'bold' }}>{selectedBooking.checkOutDate.split('T')[0]}</span>
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Current Status</span>
                <span style={{ 
                  display: 'inline-block',
                  fontSize: '12px', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontWeight: 'bold',
                  marginTop: '4px',
                  color: selectedBooking.status === 'checked_in' ? '#1e40af' : selectedBooking.status === 'checked_out' ? '#374151' : '#4338ca',
                  backgroundColor: selectedBooking.status === 'checked_in' ? '#dbeafe' : selectedBooking.status === 'checked_out' ? '#f3f4f6' : '#e0e7ff',
                }}>
                  {selectedBooking.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Actions Panel */}
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <a 
                href={`/dashboard/guests/${selectedBooking.guest.id}`}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                👤 Profile
              </a>
              <a 
                href={`/dashboard/folios/${selectedBooking.id}`}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                💳 Billing
              </a>
              <div style={{ flexGrow: 1 }} />
              <button 
                onClick={() => setSelectedBooking(null)}
                style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>

              {selectedBooking.status === 'reserved' && selectedBooking.roomId && (
                <button 
                  onClick={() => handleCheckIn(selectedBooking.id, selectedBooking.roomId!)}
                  style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🛎 Complete Check-In
                </button>
              )}

              {selectedBooking.status === 'checked_in' && (
                <button 
                  onClick={() => handleCheckOut(selectedBooking.id)}
                  style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🔑 Complete Check-Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Reservation Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            width: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e5e7eb',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>Create New Reservation</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ border: 'none', backgroundColor: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>First Name</label>
                  <input 
                    type="text" 
                    value={formData.guestFirstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, guestFirstName: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Last Name</label>
                  <input 
                    type="text" 
                    value={formData.guestLastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, guestLastName: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Email Address</label>
                <input 
                  type="email" 
                  value={formData.guestEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, guestEmail: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Check In Date</label>
                  <input 
                    type="date" 
                    value={formData.checkInDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, checkInDate: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Check Out Date</label>
                  <input 
                    type="date" 
                    value={formData.checkOutDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, checkOutDate: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Room Assignment</label>
                <select 
                  value={formData.roomId}
                  onChange={(e) => setFormData(prev => ({ ...prev, roomId: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#ffffff' }}
                >
                  <option value="">-- Select Room --</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      Room {room.roomNumber} ({room.roomType.name} - ${room.roomType.rackRate}/night)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
