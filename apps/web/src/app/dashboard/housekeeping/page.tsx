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
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isMobile, setIsMobile] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');

  useEffect(() => {
    const customUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    setApiBaseUrl(customUrl);

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

      const [roomsRes, dispatchRes, maintenanceRes] = await Promise.all([
        fetch(`${apiBaseUrl}/rooms`, { headers: getHeaders() }),
        fetch(`${apiBaseUrl}/dispatch`, { headers: getHeaders() }),
        fetch(`${apiBaseUrl}/maintenance`, { headers: getHeaders() }),
      ]);

      if (!roomsRes.ok) {
        throw new Error('Failed to fetch rooms list.');
      }

      const roomsData = await roomsRes.json();
      setRooms(roomsData);

      if (dispatchRes.ok) {
        setServiceRequests(await dispatchRes.json());
      }
      if (maintenanceRes.ok) {
        setMaintenanceTickets(await maintenanceRes.json());
      }
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
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: isMobile ? '12px' : '0' }}>
      {/* Header Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: isMobile ? '24px' : '28px', color: '#111827', fontWeight: 800 }}>Housekeeping Status</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Real-time room cleanliness tracking and status updates</p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        
        {/* Total Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Total Rooms</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>{totalCount}</div>
        </div>

        {/* Clean Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#059669', textTransform: 'uppercase' }}>Clean</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{cleanCount}</div>
        </div>

        {/* Dirty Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase' }}>Dirty</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{dirtyCount}</div>
        </div>

        {/* Occupied Rooms Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' }}>Occupied</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{occupiedCount}</div>
        </div>

      </div>

      {isMobile ? (
        /* ================= MOBILE LAYOUT ================= */
        <div>
          {/* Mobile Floor Tabs (Horizontal Scroll) */}
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            gap: '8px',
            paddingBottom: '12px',
            marginBottom: '16px',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
          }}>
            <button
              onClick={() => setFilterFloor('all')}
              style={{
                padding: '10px 18px',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '13px',
                backgroundColor: filterFloor === 'all' ? '#10b981' : '#e5e7eb',
                color: filterFloor === 'all' ? '#ffffff' : '#374151',
                cursor: 'pointer',
              }}
            >
              All Floors
            </button>
            {uniqueFloors.map(floorNum => (
              <button
                key={floorNum}
                onClick={() => setFilterFloor(floorNum.toString())}
                style={{
                  padding: '10px 18px',
                  borderRadius: '20px',
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  backgroundColor: filterFloor === floorNum.toString() ? '#10b981' : '#e5e7eb',
                  color: filterFloor === floorNum.toString() ? '#ffffff' : '#374151',
                  cursor: 'pointer',
                }}
              >
                Floor {floorNum}
              </button>
            ))}
          </div>

          {/* Touch-Friendly Vertical List of Rooms */}
          {filteredRooms.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', color: '#6b7280' }}>
              No rooms match the criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredRooms.map((room) => {
                const isClean = room.physicalStatus === 'clean';
                const roomRequests = serviceRequests.filter(
                  req => req.booking?.roomId === room.id && req.status !== 'completed' && req.status !== 'cancelled'
                );
                const roomMaintenance = maintenanceTickets.filter(
                  ticket => ticket.roomId === room.id && ticket.status !== 'completed' && ticket.status !== 'cancelled'
                );

                return (
                  <div
                    key={room.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: 800 }}>Room {room.roomNumber}</h3>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{room.roomType.name}</span>
                      </div>
                      
                      {/* Clean/Dirty Status Toggle Badge */}
                      <button
                        onClick={() => toggleCleanliness(room.id, room.physicalStatus)}
                        style={{
                          border: 'none',
                          borderRadius: '20px',
                          padding: '8px 16px',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          cursor: 'pointer',
                          backgroundColor: isClean ? '#d1fae5' : '#fee2e2',
                          color: isClean ? '#047857' : '#b91c1c',
                        }}
                      >
                        {isClean ? '🧹 CLEAN' : '⚠️ DIRTY'}
                      </button>
                    </div>

                    {/* Room Info Row */}
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                      <span style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: '#f3f4f6', borderRadius: '12px', color: '#4b5563', fontWeight: 'bold' }}>
                        Floor {room.floor.floorNumber}
                      </span>
                    </div>

                    {/* Warnings: Service Requests & Maintenance */}
                    {(roomRequests.length > 0 || roomMaintenance.length > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '10px' }}>
                        {roomRequests.map(req => (
                          <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontSize: '12px', fontWeight: '600' }}>
                            <span>🛎️</span>
                            <span><strong>Request:</strong> {req.requestType.toUpperCase()} ({req.details || 'No details'})</span>
                          </div>
                        ))}
                        {roomMaintenance.map(ticket => (
                          <div key={ticket.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontSize: '12px', fontWeight: '600' }}>
                            <span>🔧</span>
                            <span><strong>Maintenance:</strong> {ticket.description} ({ticket.priority.toUpperCase()})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tap area action */}
                    <div
                      onClick={() => toggleCleanliness(room.id, room.physicalStatus)}
                      style={{
                        border: '1px dashed #d1d5db',
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'center',
                        color: '#4b5563',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      Tap to toggle cleanliness status
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= DESKTOP LAYOUT ================= */
        <div>
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
                const roomRequests = serviceRequests.filter(
                  req => req.booking?.roomId === room.id && req.status !== 'completed' && req.status !== 'cancelled'
                );
                const roomMaintenance = maintenanceTickets.filter(
                  ticket => ticket.roomId === room.id && ticket.status !== 'completed' && ticket.status !== 'cancelled'
                );

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
                    <div style={{ display: 'flex', gap: '8px', margin: '4px 0', flexWrap: 'wrap' }}>
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

                    {/* Warning Badges on Desktop */}
                    {(roomRequests.length > 0 || roomMaintenance.length > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px' }}>
                        {roomRequests.map(req => (
                          <div key={req.id} style={{ color: '#b45309', fontSize: '12px' }}>
                            🛎️ Service request active ({req.requestType})
                          </div>
                        ))}
                        {roomMaintenance.map(ticket => (
                          <div key={ticket.id} style={{ color: '#b91c1c', fontSize: '12px' }}>
                            🔧 Maintenance ticket open ({ticket.description})
                          </div>
                        ))}
                      </div>
                    )}

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
                        backgroundColor: isClean ? '#fee2e2' : '#d1fae5',
                        color: isClean ? '#047857' : '#047857',
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
      )}
    </div>
  );
}
