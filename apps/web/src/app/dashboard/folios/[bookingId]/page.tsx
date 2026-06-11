'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface LedgerEntry {
  id: string;
  type: string;
  amount: string;
  description: string;
  sourceFolioId: string | null;
  createdAt: string;
}

interface Folio {
  id: string;
  payerType: string;
  payerGuestId: string | null;
  status: string;
  createdAt: string;
  ledgerEntries: LedgerEntry[];
  payerGuest?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function FolioViewerPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;

  const [folios, setFolios] = useState<Folio[]>([]);
  const [activeFolioIdx, setActiveFolioIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Post Charge state
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeCat, setChargeCat] = useState('food_and_beverage');
  const [postingCharge, setPostingCharge] = useState(false);

  // Post Payment state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [postingPayment, setPostingPayment] = useState(false);

  // Routing Rule state
  const [routeCat, setRouteCat] = useState('food_and_beverage');
  const [routingTargetIdx, setRoutingTargetIdx] = useState(1);
  const [creatingRule, setCreatingRule] = useState(false);

  // Create Folio state
  const [creatingFolio, setCreatingFolio] = useState(false);

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

  const fetchFolios = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/bookings/${bookingId}/folios`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch folios.');
      const data = await res.json();
      setFolios(data);
    } catch (err: any) {
      setError(err.message || 'Error loading billing folios.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (apiBaseUrl && bookingId) {
      fetchFolios();
    }
  }, [apiBaseUrl, bookingId]);

  const activeFolio = folios[activeFolioIdx];

  // Calculate Balance
  const calculateSummary = (folio: Folio) => {
    let charges = 0;
    let payments = 0;
    (folio.ledgerEntries || []).forEach(e => {
      const amt = Number(e.amount);
      if (e.type === 'payment') {
        payments += amt;
      } else {
        charges += amt;
      }
    });
    return {
      charges,
      payments,
      balance: charges - payments
    };
  };

  // Post Charge Submit
  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio) return;
    setPostingCharge(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/folios/${activeFolio.id}/charges`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          amount: Number(chargeAmount),
          description: chargeDesc,
          category: chargeCat,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to post charge.');
      }

      setChargeAmount('');
      setChargeDesc('');
      await fetchFolios(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingCharge(false);
    }
  };

  // Post Payment Submit
  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio) return;
    setPostingPayment(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/folios/${activeFolio.id}/payments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          amount: Number(paymentAmount),
          description: paymentDesc || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to post payment.');
      }

      setPaymentAmount('');
      setPaymentDesc('');

      // Auto refresh after 1200ms to allow background async queue to settle
      setTimeout(async () => {
        await fetchFolios(false);
        setPostingPayment(false);
      }, 1200);

    } catch (err: any) {
      setError(err.message);
      setPostingPayment(false);
    }
  };

  // Create Secondary Folio
  const handleCreateFolio = async () => {
    setCreatingFolio(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/folios`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          bookingId,
          payerType: 'guest',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to create secondary folio.');
      }

      await fetchFolios(false);
      // Switch to the newly created folio (index will be the last item)
      setActiveFolioIdx(folios.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingFolio(false);
    }
  };

  // Create Routing Rule Submit
  const handleCreateRoutingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio || folios.length < 2) return;
    setCreatingRule(true);
    setError('');
    try {
      const targetFolio = folios[routingTargetIdx];
      const res = await fetch(`${apiBaseUrl}/folios/${activeFolio.id}/route`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          chargeCategory: routeCat,
          splitType: 'flat',
          value: 1.00,
          targetFolioId: targetFolio.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to create routing rule.');
      }

      await fetchFolios(false);
      alert(`Billing rule created: category "${routeCat}" will route to Folio ${String.fromCharCode(65 + routingTargetIdx)}!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingRule(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontFamily: 'system-ui', color: '#6b7280' }}>Loading guest folios...</div>;
  }

  const { charges, payments, balance } = activeFolio ? calculateSummary(activeFolio) : { charges: 0, payments: 0, balance: 0 };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Navigation */}
      <a href="/dashboard/grid" style={{ color: '#4f46e5', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px', fontWeight: 'bold', fontSize: '14px' }}>
        ⬅ Back to Room Grid
      </a>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', color: '#111827', fontWeight: 800 }}>Billing Folio & Ledger</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Reservation ID: <strong style={{ color: '#4f46e5' }}>{bookingId}</strong>
          </p>
        </div>

        <button 
          onClick={handleCreateFolio}
          disabled={creatingFolio}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => { if(!creatingFolio) e.currentTarget.style.backgroundColor = '#059669' }}
          onMouseLeave={(e) => { if(!creatingFolio) e.currentTarget.style.backgroundColor = '#10b981' }}
        >
          {creatingFolio ? 'Creating Folio...' : '➕ Create Extra Folio'}
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {folios.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
          No billing files found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Folios Tabs */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid #e5e7eb', paddingBottom: '2px' }}>
            {folios.map((f, idx) => {
              const isActive = idx === activeFolioIdx;
              const nameLetter = String.fromCharCode(65 + idx); // A, B, C...
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFolioIdx(idx)}
                  style={{
                    border: 'none',
                    backgroundColor: isActive ? '#4f46e5' : 'transparent',
                    color: isActive ? '#ffffff' : '#4b5563',
                    padding: '12px 24px',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '15px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = '#e5e7eb' }}
                  onMouseLeave={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  💳 Folio {nameLetter} ({f.payerType})
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>
            
            {/* Folio Ledger Entries List */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.01)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                Ledger Entries for Folio {String.fromCharCode(65 + activeFolioIdx)}
              </h3>

              {(!activeFolio.ledgerEntries || activeFolio.ledgerEntries.length === 0) ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', border: '1px dashed #d1d5db', borderRadius: '8px' }}>
                  No transactions posted on this folio yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontWeight: 'bold' }}>
                        <th style={{ padding: '12px 8px' }}>Date</th>
                        <th style={{ padding: '12px 8px' }}>Description</th>
                        <th style={{ padding: '12px 8px' }}>Type/Category</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFolio.ledgerEntries.map((entry) => {
                        const isPayment = entry.type === 'payment';
                        return (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6', color: '#111827' }}>
                            <td style={{ padding: '12px 8px', color: '#6b7280' }}>
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px 8px', fontWeight: isPayment ? 'normal' : 'bold' }}>
                              {entry.description}
                              {entry.sourceFolioId && (
                                <span style={{ display: 'block', fontSize: '10px', color: '#3b82f6', fontWeight: 'normal', marginTop: '2px' }}>
                                  routed from Folio A
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 'bold',
                                color: isPayment ? '#065f46' : '#1e40af',
                                backgroundColor: isPayment ? '#d1fae5' : '#dbeafe',
                              }}>
                                {entry.type}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: isPayment ? '#10b981' : '#111827' }}>
                              {isPayment ? '-' : ''}${Number(entry.amount).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Billing Summary & Actions Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Balance Summary Card */}
              <div style={{ backgroundColor: '#1f2937', color: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.5px' }}>
                  Folio {String.fromCharCode(65 + activeFolioIdx)} Balance
                </h3>
                <div style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 16px 0', color: balance === 0 ? '#10b981' : '#ffffff' }}>
                  ${balance.toFixed(2)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #374151', paddingTop: '16px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af' }}>Total Charges:</span>
                    <strong style={{ color: '#f9fafb' }}>${charges.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af' }}>Total Payments:</span>
                    <strong style={{ color: '#10b981' }}>-${payments.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Post Charge Form */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#111827' }}>Post Charge</h4>
                
                <form onSubmit={handlePostCharge} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Amount ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Description</label>
                    <input 
                      type="text"
                      value={chargeDesc}
                      onChange={(e) => setChargeDesc(e.target.value)}
                      required
                      placeholder="e.g. Minibar items"
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Category</label>
                    <select
                      value={chargeCat}
                      onChange={(e) => setChargeCat(e.target.value)}
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#ffffff' }}
                    >
                      <option value="room_charge">Room Charge</option>
                      <option value="food_and_beverage">Food & Beverage</option>
                      <option value="spa">Spa Service</option>
                      <option value="parking">Parking</option>
                      <option value="other">Other Incidentals</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    disabled={postingCharge}
                    style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
                  >
                    {postingCharge ? 'Posting...' : 'Post Incidental Charge'}
                  </button>
                </form>
              </div>

              {/* Post Payment Form */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#111827' }}>Receive Credit Card Payment</h4>
                
                <form onSubmit={handlePostPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Payment Amount ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Memo (Optional)</label>
                    <input 
                      type="text"
                      value={paymentDesc}
                      onChange={(e) => setPaymentDesc(e.target.value)}
                      placeholder="e.g. Visa ending 4242"
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={postingPayment}
                    style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
                  >
                    {postingPayment ? 'Processing Async Settlement...' : 'Process Card Payment'}
                  </button>
                </form>
              </div>

              {/* Billing Routing Rules Card (Only displays if multiple folios exist) */}
              {folios.length >= 2 && activeFolioIdx === 0 && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#111827' }}>Configure Billing Routing</h4>
                  
                  <form onSubmit={handleCreateRoutingRule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Route Category</label>
                      <select
                        value={routeCat}
                        onChange={(e) => setRouteCat(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#ffffff' }}
                      >
                        <option value="food_and_beverage">Food & Beverage</option>
                        <option value="spa">Spa Service</option>
                        <option value="parking">Parking</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Route Destination</label>
                      <select
                        value={routingTargetIdx}
                        onChange={(e) => setRoutingTargetIdx(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#ffffff' }}
                      >
                        {folios.map((f, i) => {
                          if (i === 0) return null; // Can't route to itself
                          return (
                            <option key={f.id} value={i}>
                              Folio {String.fromCharCode(65 + i)} ({f.payerType})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <button 
                      type="submit"
                      disabled={creatingRule}
                      style={{ backgroundColor: '#6366f1', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
                    >
                      {creatingRule ? 'Creating...' : 'Create Routing Rule'}
                    </button>
                  </form>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
