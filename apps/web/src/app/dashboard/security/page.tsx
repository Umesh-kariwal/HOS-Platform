'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface ParkingSlot {
  id: string;
  slotIdentifier: string;
  status: string;
}

interface ValetTicket {
  id: string;
  vehicleLicense: string;
  keyTag: string;
  status: string;
  parkingSlot?: ParkingSlot | null;
  booking: {
    id: string;
    guest: {
      firstName: string;
      lastName: string;
    };
  };
}

interface VisitorRecord {
  id: string;
  firstName: string;
  lastName: string;
  idHash: string;
  checkInTime: string;
  checkOutTime: string | null;
  booking: {
    room?: {
      roomNumber: string;
    } | null;
  };
}

interface LostAndFoundItem {
  id: string;
  description: string;
  storageBin: string;
  status: string;
  claimantName?: string | null;
  claimedAt?: string | null;
  room?: {
    roomNumber: string;
  } | null;
  finder: {
    firstName: string;
    lastName: string;
  };
}

interface IncidentLog {
  id: string;
  type: string;
  details: string;
  status: string;
  escalationLevel: number;
  createdAt: string;
  loggedBy: {
    firstName: string;
    lastName: string;
  };
}

export default function SecurityPage() {
  const [token, setToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');

  // Peripherals State
  const [parkingSlots, setParkingSlots] = useState<ParkingSlot[]>([]);
  const [valetTickets, setValetTickets] = useState<ValetTicket[]>([]);
  const [visitorRecords, setVisitorRecords] = useState<VisitorRecord[]>([]);
  const [lostItems, setLostItems] = useState<LostAndFoundItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);

  // Form inputs
  const [newSlotId, setNewSlotId] = useState('');
  const [valetLicense, setValetLicense] = useState('');
  const [valetKey, setValetKey] = useState('');
  const [valetBookingId, setValetBookingId] = useState('');
  const [valetSlotId, setValetSlotId] = useState('');

  const [visitorFirstName, setVisitorFirstName] = useState('');
  const [visitorLastName, setVisitorLastName] = useState('');
  const [visitorIdNumber, setVisitorIdNumber] = useState('');
  const [visitorBookingId, setVisitorBookingId] = useState('');

  const [lostRoomId, setLostRoomId] = useState('');
  const [lostDesc, setLostDesc] = useState('');
  const [lostBin, setLostBin] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);

  const [incType, setIncType] = useState('general');
  const [incDetails, setIncDetails] = useState('');
  const [incEscalation, setIncEscalation] = useState(1);

  // UI state
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


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

  // Fetch all peripheral registries
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      
      const [parkingRes, valetRes, visitorsRes, lostRes, incidentsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/peripherals/parking`, { headers }),
        fetch(`${apiBaseUrl}/peripherals/valet`, { headers }),
        fetch(`${apiBaseUrl}/peripherals/visitors`, { headers }),
        fetch(`${apiBaseUrl}/peripherals/lost-found`, { headers }),
        fetch(`${apiBaseUrl}/peripherals/incidents`, { headers }),
      ]);

      if (parkingRes.ok) setParkingSlots(await parkingRes.json());
      if (valetRes.ok) setValetTickets(await valetRes.json());
      if (visitorsRes.ok) setVisitorRecords(await visitorsRes.json());
      if (lostRes.ok) setLostItems(await lostRes.json());
      if (incidentsRes.ok) setIncidents(await incidentsRes.json());
    } catch (err: any) {
      setError('Failed to query peripherals registries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let newSocket: any = null;
    if (token && apiBaseUrl) {
      fetchAllData();

      // Establish WebSocket Client Connection
      const wsUrl = apiBaseUrl.replace('/api/v1', '/incidents');
      console.log('[WS] Connecting to:', wsUrl);
      newSocket = io(wsUrl, {
        transports: ['websocket'],
        auth: { token },
      });

      newSocket.on('connect', () => {
        console.log('[WS] Connected successfully.');
      });

      newSocket.on('panic_alert', (payload: any) => {
        console.log('[WS] PANIC ALERT RECEIVED:', payload);
        setActiveAlert(payload);
        
        // Refresh incidents log list
        fetch(`${apiBaseUrl}/peripherals/incidents`, { headers: getHeaders() })
          .then(res => res.json())
          .then(data => setIncidents(data));

        // Auto clear alert banner after 8 seconds
        setTimeout(() => {
          setActiveAlert(null);
        }, 8000);
      });
    }

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [token, apiBaseUrl]);

  // Handle Parking Slot Creation
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotId.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/parking`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ slotIdentifier: newSlotId }),
      });
      if (res.ok) {
        setNewSlotId('');
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error creating slot');
      }
    } catch (err) {
      alert('Error creating parking slot');
    }
  };

  // Handle Valet Ticket Creation
  const handleCreateValet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/valet`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          bookingId: valetBookingId,
          vehicleLicense: valetLicense,
          keyTag: valetKey,
          parkingSlotId: valetSlotId || undefined,
        }),
      });
      if (res.ok) {
        setValetBookingId('');
        setValetLicense('');
        setValetKey('');
        setValetSlotId('');
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error creating valet ticket');
      }
    } catch (err) {
      alert('Error creating valet ticket');
    }
  };

  const handleRequestVehicle = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/valet/${id}/request`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (res.ok) fetchAllData();
    } catch (err) {
      alert('Error requesting vehicle');
    }
  };

  const handleRetrieveVehicle = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/valet/${id}/retrieve`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (res.ok) fetchAllData();
    } catch (err) {
      alert('Error retrieving vehicle');
    }
  };

  // Handle Visitor Check-in
  const handleVisitorCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/visitors`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          bookingId: visitorBookingId,
          firstName: visitorFirstName,
          lastName: visitorLastName,
          idNumber: visitorIdNumber,
        }),
      });
      if (res.ok) {
        setVisitorBookingId('');
        setVisitorFirstName('');
        setVisitorLastName('');
        setVisitorIdNumber('');
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error checking in visitor');
      }
    } catch (err) {
      alert('Error checking in visitor');
    }
  };

  const handleVisitorCheckout = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/visitors/${id}/checkout`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (res.ok) fetchAllData();
    } catch (err) {
      alert('Error checking out visitor');
    }
  };

  // Handle Lost and Found Item
  const handleReportLost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/lost-found`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          roomId: lostRoomId || undefined,
          description: lostDesc,
          storageBin: lostBin,
        }),
      });
      if (res.ok) {
        setLostRoomId('');
        setLostDesc('');
        setLostBin('');
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error reporting item');
      }
    } catch (err) {
      alert('Error reporting lost item');
    }
  };

  const handleClaimItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingItemId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/lost-found/${claimingItemId}/claim`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ claimantName }),
      });
      if (res.ok) {
        setClaimantName('');
        setClaimingItemId(null);
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error claiming item');
      }
    } catch (err) {
      alert('Error claiming item');
    }
  };

  // Handle Incident Log
  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBaseUrl}/peripherals/incidents`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          type: incType,
          details: incDetails,
          escalationLevel: Number(incEscalation),
        }),
      });
      if (res.ok) {
        setIncDetails('');
        setIncType('general');
        setIncEscalation(1);
        fetchAllData();
      }
    } catch (err) {
      alert('Error logging incident');
    }
  };

  // Handle Panic Button Trigger
  const handleTriggerPanic = async () => {
    if (!confirm('WARNING: You are triggering a P1 Emergency Panic Alert across this property. Proceed?')) {
      return;
    }
    try {
      await fetch(`${apiBaseUrl}/peripherals/incidents/panic`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ details: 'RECEPTION EMERGENCY: Panic button activated!' }),
      });
    } catch (err) {
      alert('Failed to emit panic alert.');
    }
  };

  return (
    <div style={styles.container}>
      {/* Panic Alert Visual Overlay Banner */}
      {activeAlert && (
        <div style={styles.panicOverlay}>
          <div style={styles.panicContent}>
            <span style={styles.panicIcon}>🚨</span>
            <div style={styles.panicText}>
              <h1 style={styles.panicHeading}>CRITICAL P1 PANIC TRIGGERED</h1>
              <p>{activeAlert.details}</p>
              <small>Logged by: {activeAlert.loggedBy} at {new Date(activeAlert.createdAt).toLocaleTimeString()}</small>
            </div>
            <button style={styles.panicClose} onClick={() => setActiveAlert(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Security & Peripheral Hub</h1>
          <p style={styles.subtitle}>Branch Operational Peripherals & Property Command Center</p>
        </div>
        <button style={styles.panicButton} onClick={handleTriggerPanic}>
          🚨 TRIGGER PANIC ALERT
        </button>
      </div>

      {loading && <div style={styles.loading}>Querying security registries...</div>}
      {error && <div style={styles.error}>{error}</div>}

      {/* Main Grid */}
      <div style={styles.grid}>
        
        {/* Card 1: Incident Feed & Log */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Incident logs & Feed</h2>
          
          <form onSubmit={handleLogIncident} style={styles.form}>
            <div style={styles.row}>
              <select value={incType} onChange={(e) => setIncType(e.target.value)} style={styles.input}>
                <option value="general">General Incident</option>
                <option value="maintenance">Maintenance Failure</option>
                <option value="theft">Theft / Dispute</option>
                <option value="safety">Medical / Safety</option>
              </select>
              <select value={incEscalation} onChange={(e) => setIncEscalation(Number(e.target.value))} style={styles.input}>
                <option value={1}>L1 - Low</option>
                <option value={2}>L2 - Active</option>
                <option value={3}>L3 - Critical</option>
              </select>
            </div>
            <textarea
              placeholder="Provide log description details..."
              value={incDetails}
              onChange={(e) => setIncDetails(e.target.value)}
              style={{ ...styles.input, height: '60px' }}
              required
            />
            <button type="submit" style={styles.submitBtn}>File Log Entry</button>
          </form>

          <div style={styles.listContainer}>
            {incidents.slice(0, 5).map((inc) => (
              <div
                key={inc.id}
                style={{
                  ...styles.listItem,
                  borderLeft: `4px solid ${
                    inc.type === 'panic' || inc.escalationLevel === 3 ? '#ff4d4d' : inc.escalationLevel === 2 ? '#ffa502' : '#1e90ff'
                  }`,
                  animation: inc.type === 'panic' ? 'pulse 2s infinite' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{inc.type.toUpperCase()}</strong>
                  <span style={styles.timestamp}>{new Date(inc.createdAt).toLocaleTimeString()}</span>
                </div>
                <p style={styles.listDetails}>{inc.details}</p>
                <small style={{ color: '#a4b0be' }}>Logged By: {inc.loggedBy?.firstName} {inc.loggedBy?.lastName}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Parking Slot command */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Parking Grid Configuration</h2>
          <form onSubmit={handleCreateSlot} style={styles.formRow}>
            <input
              type="text"
              placeholder="e.g. Slot 402"
              value={newSlotId}
              onChange={(e) => setNewSlotId(e.target.value)}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.actionBtn}>Add Slot</button>
          </form>

          <div style={styles.parkingGrid}>
            {parkingSlots.map((slot) => (
              <div
                key={slot.id}
                style={{
                  ...styles.parkingTile,
                  backgroundColor:
                    slot.status === 'vacant'
                      ? 'rgba(46, 213, 115, 0.15)'
                      : slot.status === 'occupied'
                      ? 'rgba(30, 144, 255, 0.15)'
                      : 'rgba(116, 125, 140, 0.15)',
                  border: `1px solid ${
                    slot.status === 'vacant' ? '#2ed573' : slot.status === 'occupied' ? '#1e90ff' : '#747d8c'
                  }`,
                }}
              >
                <div style={styles.tileId}>{slot.slotIdentifier}</div>
                <div style={styles.tileStatus}>{slot.status.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Valet Service board */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Valet Tracking Desk</h2>
          <form onSubmit={handleCreateValet} style={styles.form}>
            <input
              type="text"
              placeholder="Guest Booking ID"
              value={valetBookingId}
              onChange={(e) => setValetBookingId(e.target.value)}
              style={styles.input}
              required
            />
            <div style={styles.row}>
              <input
                type="text"
                placeholder="License Plate (e.g. XYZ-123)"
                value={valetLicense}
                onChange={(e) => setValetLicense(e.target.value)}
                style={styles.input}
                required
              />
              <input
                type="text"
                placeholder="Key Tag"
                value={valetKey}
                onChange={(e) => setValetKey(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <select value={valetSlotId} onChange={(e) => setValetSlotId(e.target.value)} style={styles.input}>
              <option value="">-- Assign Parking Slot (Optional) --</option>
              {parkingSlots
                .filter((s) => s.status === 'vacant')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.slotIdentifier}
                  </option>
                ))}
            </select>
            <button type="submit" style={styles.submitBtn}>Park Vehicle & Issue Ticket</button>
          </form>

          <div style={styles.listContainer}>
            {valetTickets.map((ticket) => (
              <div key={ticket.id} style={styles.listItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Key Tag: {ticket.keyTag}</strong>
                  <span
                    style={{
                      color: ticket.status === 'requested' ? '#ffa502' : '#2ed573',
                      fontWeight: 'bold',
                    }}
                  >
                    {ticket.status.toUpperCase()}
                  </span>
                </div>
                <div style={styles.listDetails}>
                  <div>License: {ticket.vehicleLicense}</div>
                  <div>Guest: {ticket.booking?.guest?.firstName} {ticket.booking?.guest?.lastName}</div>
                  {ticket.parkingSlot && (
                    <div style={{ color: '#1e90ff' }}>Location: {ticket.parkingSlot.slotIdentifier}</div>
                  )}
                </div>
                <div style={styles.actionsRow}>
                  {ticket.status === 'parked' && (
                    <button style={styles.inlineActionBtn} onClick={() => handleRequestVehicle(ticket.id)}>
                      Request Retrieval
                    </button>
                  )}
                  {ticket.status === 'requested' && (
                    <button style={{ ...styles.inlineActionBtn, backgroundColor: '#2ed573' }} onClick={() => handleRetrieveVehicle(ticket.id)}>
                      Mark Handed Over
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Visitor Check-In Logs */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Visitor Log Desk</h2>
          <form onSubmit={handleVisitorCheckin} style={styles.form}>
            <input
              type="text"
              placeholder="Guest Booking ID"
              value={visitorBookingId}
              onChange={(e) => setVisitorBookingId(e.target.value)}
              style={styles.input}
              required
            />
            <div style={styles.row}>
              <input
                type="text"
                placeholder="First Name"
                value={visitorFirstName}
                onChange={(e) => setVisitorFirstName(e.target.value)}
                style={styles.input}
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={visitorLastName}
                onChange={(e) => setVisitorLastName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <input
              type="text"
              placeholder="Document ID Card Number (Passport/DL)"
              value={visitorIdNumber}
              onChange={(e) => setVisitorIdNumber(e.target.value)}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.submitBtn}>Register & Check In Visitor</button>
          </form>

          <div style={styles.listContainer}>
            {visitorRecords.map((vis) => (
              <div key={vis.id} style={styles.listItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{vis.firstName} {vis.lastName}</strong>
                  <span>{vis.booking?.room ? `Room ${vis.booking.room.roomNumber}` : 'In House'}</span>
                </div>
                <div style={{ ...styles.listDetails, fontSize: '11px', color: '#a4b0be' }}>
                  SHA-256 ID: {vis.idHash.substring(0, 16)}...
                </div>
                <div style={styles.actionsRow}>
                  {!vis.checkOutTime ? (
                    <button style={styles.inlineActionBtn} onClick={() => handleVisitorCheckout(vis.id)}>
                      Check Out Visitor
                    </button>
                  ) : (
                    <span style={{ color: '#747d8c', fontSize: '12px' }}>
                      Out: {new Date(vis.checkOutTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 5: Lost & Found Registry */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Lost & Found Registry</h2>
          <form onSubmit={handleReportLost} style={styles.form}>
            <div style={styles.row}>
              <input
                type="text"
                placeholder="Room ID (Optional)"
                value={lostRoomId}
                onChange={(e) => setLostRoomId(e.target.value)}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Storage Bin Location"
                value={lostBin}
                onChange={(e) => setLostBin(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <input
              type="text"
              placeholder="Item description details..."
              value={lostDesc}
              onChange={(e) => setLostDesc(e.target.value)}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.submitBtn}>File Lost Item Entry</button>
          </form>

          {claimingItemId && (
            <form onSubmit={handleClaimItem} style={{ ...styles.form, border: '1px solid #ffa502', padding: '10px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ffa502' }}>Confirm Claimant Signature:</span>
                <button type="button" onClick={() => setClaimingItemId(null)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}>Cancel</button>
              </div>
              <input
                type="text"
                placeholder="Claimant Full Name"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                style={styles.input}
                required
              />
              <button type="submit" style={{ ...styles.submitBtn, backgroundColor: '#ffa502' }}>Disburse & Close Ticket</button>
            </form>
          )}

          <div style={styles.listContainer}>
            {lostItems.map((item) => (
              <div key={item.id} style={styles.listItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{item.description}</strong>
                  <span
                    style={{
                      color: item.status === 'claimed' ? '#747d8c' : '#ffa502',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <div style={styles.listDetails}>
                  <div>Location: {item.storageBin}</div>
                  {item.room && <div>Found in Room: {item.room.roomNumber}</div>}
                  {item.status === 'claimed' && (
                    <div style={{ fontSize: '11px', color: '#2ed573' }}>
                      Claimed by: {item.claimantName}
                    </div>
                  )}
                </div>
                <div style={styles.actionsRow}>
                  {item.status === 'reported' && !claimingItemId && (
                    <button style={styles.inlineActionBtn} onClick={() => setClaimingItemId(item.id)}>
                      Handover / Claim
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// Styling Object
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '24px',
    backgroundColor: '#0f0f12',
    minHeight: '100vh',
    fontFamily: '"Outfit", "Inter", sans-serif',
    color: '#f1f2f6',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: 0,
    background: 'linear-gradient(90deg, #ff4d4d, #1e90ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: '#a4b0be',
    margin: '4px 0 0 0',
    fontSize: '14px',
  },
  panicButton: {
    backgroundColor: '#ff4d4d',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 0 15px rgba(255, 77, 77, 0.5)',
    transition: 'all 0.3s ease',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: 'rgba(30, 30, 38, 0.6)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 16px 0',
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  input: {
    backgroundColor: '#15151b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '10px',
    color: '#f1f2f6',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
  },
  submitBtn: {
    backgroundColor: '#1e90ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  actionBtn: {
    backgroundColor: '#2ed573',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '8px',
    overflowY: 'auto',
    maxHeight: '350px',
  },
  listItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  listDetails: {
    fontSize: '13px',
    color: '#ced6e0',
  },
  timestamp: {
    fontSize: '11px',
    color: '#747d8c',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '6px',
  },
  inlineActionBtn: {
    backgroundColor: '#ffa502',
    color: '#15151b',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  parkingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: '12px',
  },
  parkingTile: {
    borderRadius: '8px',
    padding: '12px 6px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
  },
  tileId: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#ffffff',
  },
  tileStatus: {
    fontSize: '10px',
    fontWeight: '600',
  },
  panicOverlay: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(255, 77, 77, 0.95)',
    border: '2px solid #ffffff',
    borderRadius: '12px',
    padding: '16px 24px',
    zIndex: 9999,
    boxShadow: '0 0 30px rgba(255, 77, 77, 0.8)',
    width: '90%',
    maxWidth: '600px',
    animation: 'pulse 1s infinite alternate',
  },
  panicContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  panicIcon: {
    fontSize: '36px',
  },
  panicText: {
    flex: 1,
    color: '#ffffff',
  },
  panicHeading: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '900',
    letterSpacing: '1px',
  },
  panicClose: {
    backgroundColor: '#ffffff',
    color: '#ff4d4d',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '12px',
    color: '#1e90ff',
  },
  error: {
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    color: '#ff4d4d',
    border: '1px solid #ff4d4d',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '16px',
    textAlign: 'center',
  },
};
