'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileMetadata: any;
}

interface Booking {
  id: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: 'reserved' | 'checked_in' | 'checked_out';
  room: {
    roomNumber: string;
  } | null;
}

export default function GuestDetailPage() {
  const params = useParams();
  const guestId = params.id as string;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [vip, setVip] = useState(false);

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
      // Fetch guest profile
      const guestRes = await fetch(`${apiBaseUrl}/guests/${guestId}`, {
        headers: getHeaders(),
      });
      if (!guestRes.ok) throw new Error('Failed to fetch guest profile.');
      const guestData = await guestRes.json();
      setGuest(guestData);
      setFirstName(guestData.firstName);
      setLastName(guestData.lastName);
      setPhone(guestData.phone || '');
      setVip(guestData.profileMetadata?.vip || false);

      // Fetch bookings and filter by guest ID
      const bookingsRes = await fetch(`${apiBaseUrl}/bookings`, {
        headers: getHeaders(),
      });
      if (!bookingsRes.ok) throw new Error('Failed to fetch bookings list.');
      const bookingsData = await bookingsRes.json();
      const filtered = bookingsData.filter((b: any) => b.guestId === guestId);
      setBookings(filtered);
    } catch (err: any) {
      setError(err.message || 'Error loading guest details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiBaseUrl && guestId) {
      fetchData();
    }
  }, [apiBaseUrl, guestId]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/guests/${guestId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || undefined,
          profileMetadata: { vip }
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update guest profile.');
      }

      const updatedGuest = await res.json();
      setGuest(updatedGuest);
      setSuccessMsg('Guest profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontFamily: 'system-ui', color: '#6b7280' }}>Loading guest file...</div>;
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Back to Grid Link */}
      <a href="/dashboard/grid" style={{ color: '#4f46e5', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px', fontWeight: 'bold', fontSize: '14px' }}>
        ⬅ Back to Room Grid
      </a>

      {guest ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          {/* Guest Profile Edit Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#111827' }}>Guest Profile</h2>
              {vip && (
                <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  ★ VIP Guest
                </span>
              )}
            </div>

            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', fontWeight: 'bold' }}>
                ⚠️ {error}
              </div>
            )}
            {successMsg && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', fontWeight: 'bold' }}>
                ✓ {successMsg}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>First Name</label>
                  <input 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Last Name</label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Email Address</label>
                <input 
                  type="email" 
                  value={guest.email}
                  disabled
                  style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Phone Number</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <input 
                  type="checkbox" 
                  id="vip-checkbox"
                  checked={vip}
                  onChange={(e) => setVip(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="vip-checkbox" style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                  Mark Guest as VIP
                </label>
              </div>

              <button 
                type="submit" 
                disabled={updating}
                style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => { if(!updating) e.currentTarget.style.backgroundColor = '#4338ca' }}
                onMouseLeave={(e) => { if(!updating) e.currentTarget.style.backgroundColor = '#4f46e5' }}
              >
                {updating ? 'Saving Profile...' : 'Save Profile Details'}
              </button>
            </form>
          </div>

          {/* Bookings History Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '22px', fontWeight: 800, color: '#111827' }}>Reservation History</h2>

            {bookings.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
                No reservation records found for this guest.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {bookings.map((booking) => (
                  <div key={booking.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '15px', marginBottom: '4px' }}>
                        🏨 Room {booking.room ? booking.room.roomNumber : 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        📅 {booking.checkInDate.split('T')[0]} to {booking.checkOutDate.split('T')[0]}
                      </div>
                      <span style={{ 
                        display: 'inline-block', 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        padding: '2px 8px', 
                        borderRadius: '10px', 
                        marginTop: '8px',
                        color: booking.status === 'checked_in' ? '#1e40af' : booking.status === 'checked_out' ? '#374151' : '#4338ca',
                        backgroundColor: booking.status === 'checked_in' ? '#dbeafe' : booking.status === 'checked_out' ? '#f3f4f6' : '#e0e7ff'
                      }}>
                        {booking.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Folio Billing Link */}
                    <a 
                      href={`/dashboard/folios/${booking.id}`}
                      style={{
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        textDecoration: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    >
                      💳 View Billing
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
          Guest file not found or access denied.
        </div>
      )}

    </div>
  );
}
