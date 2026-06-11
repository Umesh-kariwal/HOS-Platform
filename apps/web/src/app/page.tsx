import React from 'react';

export default function DashboardPage() {
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ color: '#111827', margin: '0 0 8px 0' }}>HOS Platform Control Center</h1>
      <p style={{ color: '#4b5563', margin: '0 0 24px 0' }}>Hotel Operating System v4.0 Active Schema Context</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>Room Grid</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px 0' }}>Drag-and-Drop room mapping timeline grid.</p>
          <a href="/dashboard/grid" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>Open Grid &rarr;</a>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>Housekeeping</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px 0' }}>Mobile-first housekeeper status checklists.</p>
          <a href="/dashboard/housekeeping" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>Open Checklist &rarr;</a>
        </div>
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827' }}>Night Audit</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px 0' }}>Daily ledger settlements and rollover.</p>
          <a href="/dashboard/night-audit" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>Open Audit &rarr;</a>
        </div>
      </div>
    </div>
  );
}
