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
  };
  floor: {
    name: string;
    floorNumber: number;
  };
}

export default function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

  const fetchRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('hos_jwt_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(`${apiBaseUrl}/rooms`, {
        headers: getHeaders(),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch rooms list.');
      }

      const data = await res.json();
      setRooms(data);
    } catch (err: any) {
      setError(err.message || 'Error loading rooms data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiBaseUrl) {
      fetchRooms();
    }
  }, [apiBaseUrl]);

  // Toggle room cleanliness status
  const toggleCleanliness = async (roomId: string, currentStatus: 'clean' | 'dirty') => {
    const nextStatus = currentStatus === 'clean' ? 'dirty' : 'clean';
    try {
      const res = await fetch(`${apiBaseUrl}/rooms/${roomId}/status`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ physicalStatus: nextStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update room cleanliness status.');
      }

      // Optimistically update local state
      setRooms(prevRooms => 
        prevRooms.map(r => r.id === roomId ? { ...r, physicalStatus: nextStatus } : r)
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Metrics Calculations
  const totalCount = rooms.length;
  const cleanCount = rooms.filter(r => r.physicalStatus === 'clean').length;
  const dirtyCount = rooms.filter(r => r.physicalStatus === 'dirty').length;
  const occupiedCount = rooms.filter(r => r.occupancyStatus === 'occupied').length;
  const vacantCount = rooms.filter(r => r.occupancyStatus === 'vacant').length;

  // Extract unique floors for filter
  const uniqueFloors = Array.from(new Set(rooms.map(r => r.floor.floorNumber))).sort((a, b) => a - b);

  // Filtered rooms list
  const filteredRooms = rooms.filter(room => {
    const matchFloor = filterFloor === 'all' || room.floor.floorNumber.toString() === filterFloor;
    const matchStatus = filterStatus === 'all' || room.physicalStatus === filterStatus || room.occupancyStatus === filterStatus;
    return matchFloor && matchStatus;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
        <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #10b981', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ fontFamily: 'system-ui', color: '#6b7280' }}>Loading Housekeeping Panel...</div>
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
      {/* Header Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', color: '#111827', fontWeight: 800 }}>Housekeeping Status</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Real-time room cleanliness tracking and status updates</p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        
        {/* Total Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Total Rooms</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>{totalCount}</div>
        </div>

        {/* Clean Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669', textTransform: 'uppercase' }}>Clean Rooms</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{cleanCount}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{Math.round((cleanCount / totalCount) * 100) || 0}% of inventory</div>
        </div>

        {/* Dirty Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase' }}>Dirty Rooms</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{dirtyCount}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{Math.round((dirtyCount / totalCount) * 100) || 0}% requires attention</div>
        </div>

        {/* Occupied Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' }}>Occupied</span>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{occupiedCount}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{vacantCount} vacant rooms</div>
        </div>

      </div>

      {/* Filters Toolbar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', backgroundColor: '#f3f4f6', padding: '12px 16px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Filters:</span>
        
        {/* Floor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#4b5563' }}>Floor</label>
          <select 
            value={filterFloor} 
            onChange={(e) => setFilterFloor(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '13px' }}
          >
            <option value="all">All Floors</option>
            {uniqueFloors.map(floorNum => (
              <option key={floorNum} value={floorNum.toString()}>Floor {floorNum}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: '#4b5563' }}>Status</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '13px' }}
          >
            <option value="all">All Statuses</option>
            <option value="clean">Clean Rooms</option>
            <option value="dirty">Dirty Rooms</option>
            <option value="occupied">Occupied</option>
            <option value="vacant">Vacant</option>
          </select>
        </div>

        {/* Refresh button */}
        <button 
          onClick={fetchRooms}
          style={{
            marginLeft: 'auto',
            padding: '6px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#374151',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Rooms Cards List */}
      {filteredRooms.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
          No rooms match the active filter criteria.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filteredRooms.map((room) => {
            const isClean = room.physicalStatus === 'clean';
            return (
              <div 
                key={room.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)'}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: 'bold' }}>Room {room.roomNumber}</h3>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{room.roomType.name}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                    Floor {room.floor.floorNumber}
                  </span>
                </div>

                {/* Badges Info */}
                <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
                  {/* Clean/Dirty Status Badge */}
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '3px 8px', 
                    borderRadius: '12px', 
                    fontWeight: 'bold',
                    color: isClean ? '#047857' : '#b45309',
                    backgroundColor: isClean ? '#d1fae5' : '#fef3c7',
                  }}>
                    🛡️ {room.physicalStatus.toUpperCase()}
                  </span>

                  {/* Occupancy Status Badge */}
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '3px 8px', 
                    borderRadius: '12px', 
                    fontWeight: 'bold',
                    color: room.occupancyStatus === 'occupied' ? '#1d4ed8' : '#374151',
                    backgroundColor: room.occupancyStatus === 'occupied' ? '#dbeafe' : '#f3f4f6',
                  }}>
                    {room.occupancyStatus === 'occupied' ? '👤 OCCUPIED' : '🔑 VACANT'}
                  </span>
                </div>

                {/* Divider */}
                <hr style={{ border: 0, borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />

                {/* Change Cleanliness Action Button */}
                <button 
                  onClick={() => toggleCleanliness(room.id, room.physicalStatus)}
                  style={{
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'center',
                    transition: 'background-color 0.2s',
                    // Button styling based on toggle clean/dirty action
                    backgroundColor: isClean ? '#fee2e2' : '#d1fae5',
                    color: isClean ? '#b91c1c' : '#047857',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isClean ? '#fecaca' : '#a7f3d0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isClean ? '#fee2e2' : '#d1fae5';
                  }}
                >
                  {isClean ? '🧹 Mark Room Dirty' : '✅ Mark Room Clean'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
