'use client';

import React, { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid login credentials');
      }

      const data = await response.json();
      localStorage.setItem('hos_jwt_token', data.token);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', width: '320px' }}>
        <h2 style={{ margin: '0 0 24px 0', textAlign: 'center', color: '#111827' }}>HOS Sign In</h2>
        
        {error && <div style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '8px', borderRadius: '4px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '4px' }}>Email Address</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '4px' }} 
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '4px' }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '4px' }} 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
