'use client';

import React, { useEffect, useState } from 'react';

interface RoomType {
  id: string;
  code: string;
  name: string;
  rackRate: string | number;
}

interface RevenuePricingRule {
  id: string;
  roomTypeId: string;
  ruleType: 'occupancy_gte' | 'occupancy_lte' | 'lead_time_lte';
  triggerValue: number;
  adjustmentPercent: number;
  isActive: boolean;
  roomType: RoomType;
  createdAt: string;
}

export default function RevenueDashboard() {
  const [rules, setRules] = useState<RevenuePricingRule[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');

  // Form states
  const [newRoomTypeId, setNewRoomTypeId] = useState('');
  const [newRuleType, setNewRuleType] = useState('occupancy_gte');
  const [newTriggerValue, setNewTriggerValue] = useState('');
  const [newAdjustmentPercent, setNewAdjustmentPercent] = useState('');

  // Simulator states
  const [simRoomTypeId, setSimRoomTypeId] = useState('');
  const [simDate, setSimDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [simLeadTimeDays, setSimLeadTimeDays] = useState('0');
  const [simulatedRate, setSimulatedRate] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);

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
      const [rulesRes, typesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/revenue/rules`, { headers }),
        fetch(`${apiBaseUrl}/rooms/types`, { headers }),
      ]);

      if (rulesRes.ok) {
        setRules(await rulesRes.json());
      }
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setRoomTypes(typesData);
        if (typesData.length > 0) {
          setNewRoomTypeId(typesData[0].id);
          setSimRoomTypeId(typesData[0].id);
        }
      }
    } catch (err: any) {
      setError('Failed to fetch revenue optimization rules and configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, apiBaseUrl]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTypeId || !newRuleType || newTriggerValue === '' || newAdjustmentPercent === '') {
      alert('Please fill out all fields.');
      return;
    }

    try {
      // If rule is occupancy-based, check if user typed it as percentage (e.g. 75) and convert to decimal fraction
      let trigger = parseFloat(newTriggerValue);
      if (newRuleType.startsWith('occupancy') && trigger > 1) {
        trigger = trigger / 100;
      }

      const res = await fetch(`${apiBaseUrl}/revenue/rules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          roomTypeId: newRoomTypeId,
          ruleType: newRuleType,
          triggerValue: trigger,
          adjustmentPercent: parseFloat(newAdjustmentPercent) / 100, // input is percentage, e.g. 15 -> 0.15
        }),
      });

      if (res.ok) {
        setNewTriggerValue('');
        setNewAdjustmentPercent('');
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error creating pricing rule');
      }
    } catch (err) {
      alert('Failed to connect to API to create rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/revenue/rules/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error deleting rule');
      }
    } catch (err) {
      alert('Failed to connect to API to delete rule');
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simRoomTypeId || !simDate) return;
    setSimulating(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/revenue/calculate-rate?roomTypeId=${simRoomTypeId}&date=${simDate}&leadTimeDays=${simLeadTimeDays}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setSimulatedRate(data.rate);
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error simulating rate');
      }
    } catch (err) {
      alert('Failed to connect to API to calculate rate');
    } finally {
      setSimulating(false);
    }
  };

  // Helper labels
  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'occupancy_gte': return 'Occupancy ≥';
      case 'occupancy_lte': return 'Occupancy ≤';
      case 'lead_time_lte': return 'Lead Time ≤';
      default: return type;
    }
  };

  const getTriggerValueDisplay = (type: string, val: number) => {
    if (type.startsWith('occupancy')) {
      return `${(val * 100).toFixed(0)}%`;
    }
    return `${val} Days`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#0b0f19' }}>
        <div style={{ fontFamily: 'system-ui', color: '#94a3b8' }}>Loading Revenue & Dynamic Pricing Console...</div>
      </div>
    );
  }

  // Find simulated room type
  const simRoomType = roomTypes.find(rt => rt.id === simRoomTypeId);

  return (
    <div style={{ padding: '28px', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#080c14', minHeight: '100vh', color: '#f8fafc' }}>
      
      {/* Premium Header */}
      <div style={{ marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 800, 
          margin: '0 0 6px 0', 
          background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 50%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Dynamic Pricing & Revenue Optimization
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
          Manage real-time demand tariffs, occupancy multipliers, and execute property pricing simulations.
        </p>
      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Side: Rules List & Pricing Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Rules List Card */}
          <div style={{ 
            background: 'rgba(22, 28, 45, 0.45)', 
            backdropFilter: 'blur(12px)', 
            borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.06)', 
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>Active Optimization Rules</h2>
              <span style={{ fontSize: '12px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                {rules.length} Rules Active
              </span>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#94a3b8' }}>Room Type</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#94a3b8' }}>Trigger Condition</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#94a3b8' }}>Adjustment</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#94a3b8', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
                        No pricing rules configured for this branch yet. Use the panel on the right to add one.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => {
                      const isPositive = rule.adjustmentPercent >= 0;
                      return (
                        <tr key={rule.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{rule.roomType?.name || 'Unknown Room Type'}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Code: {rule.roomType?.code || 'N/A'}</div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ 
                              fontSize: '13px', 
                              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                              padding: '4px 8px', 
                              borderRadius: '6px',
                              color: '#cbd5e1',
                              fontWeight: 500
                            }}>
                              {getRuleTypeLabel(rule.ruleType)} {getTriggerValueDisplay(rule.ruleType, Number(rule.triggerValue))}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ 
                              fontWeight: 700, 
                              color: isPositive ? '#34d399' : '#f87171',
                              backgroundColor: isPositive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                              padding: '4px 8px',
                              borderRadius: '6px'
                            }}>
                              {isPositive ? '+' : ''}{(Number(rule.adjustmentPercent) * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rate Simulator Card */}
          <div style={{ 
            background: 'rgba(22, 28, 45, 0.45)', 
            backdropFilter: 'blur(12px)', 
            borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.06)', 
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
            padding: '24px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#f1f5f9' }}>Real-time Pricing Simulator</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px 0' }}>
              Simulate dynamic rate adjustments for a room type based on target date occupancy and bookings lead time.
            </p>

            <form onSubmit={handleSimulate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '16px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Select Room Type</label>
                <select
                  value={simRoomTypeId}
                  onChange={(e) => setSimRoomTypeId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="" disabled>Choose Room Type</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name} ({rt.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Target Date</label>
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Lead Time (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={simLeadTimeDays}
                  onChange={(e) => setSimLeadTimeDays(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={simulating}
                style={{
                  padding: '11px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                }}
              >
                {simulating ? 'Calculating...' : 'Run Simulation'}
              </button>
            </form>

            {/* Simulation Results Display */}
            {simulatedRate !== null && simRoomType && (
              <div style={{ 
                marginTop: '24px', 
                padding: '20px', 
                backgroundColor: 'rgba(15, 23, 42, 0.4)', 
                borderRadius: '12px', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Simulation Result</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {simRoomType.name} Dynamic Rate
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Standard Rack Rate: ${Number(simRoomType.rackRate).toFixed(2)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Calculated Price</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: '#60a5fa', marginTop: '2px' }}>
                    ${simulatedRate.toFixed(2)}
                  </div>
                  {Number(simulatedRate) !== Number(simRoomType.rackRate) && (
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: 700, 
                      color: Number(simulatedRate) > Number(simRoomType.rackRate) ? '#34d399' : '#f87171',
                      backgroundColor: Number(simulatedRate) > Number(simRoomType.rackRate) ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {Number(simulatedRate) > Number(simRoomType.rackRate) ? 'Surge +' : 'Discount -'}
                      {(((Number(simulatedRate) - Number(simRoomType.rackRate)) / Number(simRoomType.rackRate)) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Creator Form Panel */}
        <div>
          <div style={{ 
            background: 'rgba(22, 28, 45, 0.45)', 
            backdropFilter: 'blur(12px)', 
            borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.06)', 
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
            padding: '24px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: '#f1f5f9' }}>Create Pricing Rule</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px 0' }}>
              Add a new automated pricing adjustment based on occupancy or lead time metrics.
            </p>

            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Target Room Type</label>
                <select
                  value={newRoomTypeId}
                  onChange={(e) => setNewRoomTypeId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  required
                >
                  <option value="" disabled>Select Room Type</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name} ({rt.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Rule Trigger Type</label>
                <select
                  value={newRuleType}
                  onChange={(e) => {
                    setNewRuleType(e.target.value);
                    setNewTriggerValue('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  required
                >
                  <option value="occupancy_gte">Occupancy Rate is greater or equal (occupancy_gte)</option>
                  <option value="occupancy_lte">Occupancy Rate is less or equal (occupancy_lte)</option>
                  <option value="lead_time_lte">Days before Check-In is less or equal (lead_time_lte)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                  {newRuleType.startsWith('occupancy') ? 'Trigger Value (Occupancy % e.g. 70 for 70%)' : 'Trigger Value (Lead Time Days)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={newRuleType.startsWith('occupancy') ? '100' : undefined}
                  value={newTriggerValue}
                  onChange={(e) => setNewTriggerValue(e.target.value)}
                  placeholder={newRuleType.startsWith('occupancy') ? 'e.g. 80' : 'e.g. 7'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                  Adjustment Percentage (+/- % e.g. 15 for +15%, -10 for -10%)
                </label>
                <input
                  type="number"
                  step="any"
                  value={newAdjustmentPercent}
                  onChange={(e) => setNewAdjustmentPercent(e.target.value)}
                  placeholder="e.g. 15 or -10"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '10px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                Add Pricing Rule
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
