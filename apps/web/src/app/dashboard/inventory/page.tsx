'use client';

import React, { useEffect, useState } from 'react';

interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  safetyStockThreshold: number;
}

interface StockLevel {
  id: string;
  inventoryLocationId: string;
  itemId: string;
  quantity: number;
  updatedAt: string;
  item: Item;
}

interface InventoryLocation {
  id: string;
  name: string;
  isActive: boolean;
  stockLevels: StockLevel[];
}

interface Booking {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: {
    firstName: string;
    lastName: string;
  };
  room: {
    id: string;
    roomNumber: string;
  } | null;
}

export default function InventoryPage() {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000/api/v1');
  const [activeTab, setActiveTab] = useState<'stock' | 'minibar' | 'catalog'>('stock');

  // Form inputs
  // 1. Create Location
  const [newLocName, setNewLocName] = useState('');
  // 2. Create Item
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemThreshold, setNewItemThreshold] = useState(10);
  // 3. Adjust Stock
  const [adjustLocId, setAdjustLocId] = useState('');
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  // 4. Minibar billing
  const [consumeRoomNum, setConsumeRoomNum] = useState('');
  const [consumeSku, setConsumeSku] = useState('');
  const [consumeQty, setConsumeQty] = useState(1);
  const [consumePrice, setConsumePrice] = useState(5.0);

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
    try {
      const headers = getHeaders();
      const [locsRes, itemsRes, bookingsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/inventory/locations`, { headers }),
        fetch(`${apiBaseUrl}/inventory/items`, { headers }),
        fetch(`${apiBaseUrl}/bookings`, { headers }),
      ]);

      if (locsRes.ok) setLocations(await locsRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (bookingsRes.ok) {
        const allBookings = await bookingsRes.json();
        // Checked in bookings with valid rooms
        setBookings(allBookings.filter((b: any) => b.status === 'checked_in' && b.room));
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && apiBaseUrl) {
      fetchData();
    }
  }, [token, apiBaseUrl]);

  // Create Location Form handler
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    try {
      const res = await fetch(`${apiBaseUrl}/inventory/locations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newLocName }),
      });

      if (res.ok) {
        setNewLocName('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Error creating location');
      }
    } catch (err) {
      alert('Network error creating location');
    }
  };

  // Create Item Form handler
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemSku.trim() || !newItemName.trim() || !newItemCategory.trim()) return;

    try {
      const res = await fetch(`${apiBaseUrl}/inventory/items`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          sku: newItemSku,
          name: newItemName,
          category: newItemCategory,
          safetyStockThreshold: newItemThreshold,
        }),
      });

      if (res.ok) {
        setNewItemSku('');
        setNewItemName('');
        setNewItemCategory('');
        setNewItemThreshold(10);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Error creating catalog item');
      }
    } catch (err) {
      alert('Network error creating catalog item');
    }
  };

  // Adjust Stock Form handler
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustLocId || !adjustItemId) return;

    try {
      const res = await fetch(`${apiBaseUrl}/inventory/stock`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          inventoryLocationId: adjustLocId,
          itemId: adjustItemId,
          quantity: adjustQty,
        }),
      });

      if (res.ok) {
        setAdjustLocId('');
        setAdjustItemId('');
        setAdjustQty(0);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Error adjusting stock levels');
      }
    } catch (err) {
      alert('Network error adjusting stock levels');
    }
  };

  // Consume Minibar / Post Folio charge handler
  const handleConsumeMinibar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeRoomNum || !consumeSku) return;

    try {
      const res = await fetch(`${apiBaseUrl}/inventory/minibar/consume`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          roomNumber: consumeRoomNum,
          sku: consumeSku,
          quantity: consumeQty,
          unitPrice: Number(consumePrice),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully auto-billed Room ${consumeRoomNum} minibar consumption!\nFolio ID: ${data.folioId}\nLedger Entry amount: $${data.chargeEntry.amount}`);
        setConsumeRoomNum('');
        setConsumeSku('');
        setConsumeQty(1);
        setConsumePrice(5.0);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Error posting minibar consumption');
      }
    } catch (err) {
      alert('Network error posting minibar consumption');
    }
  };

  // Compute metrics
  const totalStockItems = items.length;
  const totalLocations = locations.length;
  let totalStockCount = 0;
  let lowStockAlerts = 0;

  locations.forEach(loc => {
    (loc.stockLevels || []).forEach(stock => {
      totalStockCount += stock.quantity;
      if (stock.quantity <= (stock.item?.safetyStockThreshold || 10)) {
        lowStockAlerts++;
      }
    });
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-medium">Loading inventory console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory & Minibar Management</h1>
            <p className="text-sm text-slate-400 mt-1">Manage dry stock items, storage locations, and automated minibar checkout folio charge posts.</p>
          </div>
          <div className="flex gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 self-start">
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === 'stock' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stock Manager
            </button>
            <button
              onClick={() => setActiveTab('minibar')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === 'minibar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Minibar Billing (checkout)
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Catalog & Setup
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Dashboard Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Locations</p>
            <p className="text-2xl font-extrabold text-slate-100 mt-1">{totalLocations}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tracked SKUs</p>
            <p className="text-2xl font-extrabold text-slate-100 mt-1">{totalStockItems}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Stock Units</p>
            <p className="text-2xl font-extrabold text-slate-100 mt-1">{totalStockCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 bg-rose-500/10 text-rose-500 text-[10px] px-2.5 py-1 font-bold rounded-bl-lg">Alerts</div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Low Stock Warnings</p>
            <p className={`text-2xl font-extrabold mt-1 ${lowStockAlerts > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {lowStockAlerts}
            </p>
          </div>
        </div>

        {/* Dynamic Tab Views */}

        {/* TAB 1: Stock levels and adjustments */}
        {activeTab === 'stock' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Locations and Stock Levels Grid */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-bold text-slate-200">Current Stock Levels by Location</h2>
              {locations.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                  No inventory locations configured. Please go to the Setup tab.
                </div>
              ) : (
                locations.map((loc) => (
                  <div key={loc.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-sm text-slate-200">{loc.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono">
                        {(loc.stockLevels || []).length} items tracked
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/20">
                            <th className="p-3">SKU</th>
                            <th className="p-3">Item Name</th>
                            <th className="p-3">Category</th>
                            <th className="p-3 text-right">Qty</th>
                            <th className="p-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(loc.stockLevels || []).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-500 italic">No stock records in this location.</td>
                            </tr>
                          ) : (
                            loc.stockLevels.map((st) => {
                              const isLowStock = st.quantity <= (st.item?.safetyStockThreshold || 10);
                              return (
                                <tr key={st.id} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                                  <td className="p-3 font-mono font-bold text-slate-400">{st.item?.sku}</td>
                                  <td className="p-3 font-medium text-slate-200">{st.item?.name}</td>
                                  <td className="p-3 text-slate-400">{st.item?.category}</td>
                                  <td className="p-3 text-right font-bold text-slate-100">{st.quantity}</td>
                                  <td className="p-3 text-right">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      isLowStock ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                      {isLowStock ? 'Low Stock' : 'Optimal'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Adjust Stock Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 self-start">
              <h2 className="text-base font-bold text-slate-200">Adjust Stock Count</h2>
              <p className="text-xs text-slate-500">Record a physical stocktake or count adjustment for a specific location.</p>
              
              <form onSubmit={handleAdjustStock} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Location</label>
                  <select
                    value={adjustLocId}
                    onChange={(e) => setAdjustLocId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Item SKU</label>
                  <select
                    value={adjustItemId}
                    onChange={(e) => setAdjustItemId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose SKU --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>[{it.sku}] {it.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">New Absolute Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={!adjustLocId || !adjustItemId}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-2.5 text-xs font-bold transition-all shadow-md mt-2 disabled:bg-slate-800 disabled:text-slate-600"
                >
                  Adjust Stock Count
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: Minibar checkout auto-billing */}
        {activeTab === 'minibar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Checked-In Rooms Reference List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-bold text-slate-200">Checked-In Hotel Rooms (Occupied)</h2>
              <p className="text-xs text-slate-500">Only guests that are currently checked-in are eligible for minibar auto-billing postings.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bookings.length === 0 ? (
                  <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                    No active checked-in guests found at the property.
                  </div>
                ) : (
                  bookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setConsumeRoomNum(b.room?.roomNumber || '')}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        consumeRoomNum === b.room?.roomNumber
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-[1.01]'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-base">Room {b.room?.roomNumber}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded font-mono uppercase bg-indigo-950/40 text-indigo-400">
                          Active Guest
                        </span>
                      </div>
                      <p className="text-xs font-medium mt-2 truncate">
                        Guest: {b.guest.firstName} {b.guest.lastName}
                      </p>
                      <div className="text-[10px] mt-1 text-slate-400 flex justify-between">
                        <span>In: {b.checkInDate.split('T')[0]}</span>
                        <span>Out: {b.checkOutDate.split('T')[0]}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Bill Minibar Consumption to Folio Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 self-start">
              <h2 className="text-base font-bold text-slate-200">Bill Minibar to Room</h2>
              <p className="text-xs text-slate-500">Charges will deduct stock level and write a debit entry on the guest's folio.</p>

              <form onSubmit={handleConsumeMinibar} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={consumeRoomNum}
                    onChange={(e) => setConsumeRoomNum(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Consumed Item</label>
                  <select
                    value={consumeSku}
                    onChange={(e) => setConsumeSku(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Select Product --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.sku}>[{it.sku}] {it.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={consumeQty}
                      onChange={(e) => setConsumeQty(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={consumePrice}
                      onChange={(e) => setConsumePrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-900/40 p-3 rounded-lg text-xs flex justify-between items-center text-indigo-300 mt-2">
                  <span>Total Charges:</span>
                  <span className="font-extrabold text-base text-white">${(consumeQty * consumePrice).toFixed(2)}</span>
                </div>

                <button
                  type="submit"
                  disabled={!consumeRoomNum || !consumeSku}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg p-2.5 text-xs font-bold transition-all shadow-md mt-2 disabled:bg-slate-800 disabled:text-slate-600"
                >
                  Bill Folio & Update Stock
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: Catalog and Location setup */}
        {activeTab === 'catalog' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Locations Manager */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-200">Inventory Storage Locations</h2>
              <form onSubmit={handleCreateLocation} className="flex gap-2">
                <input
                  type="text"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="e.g. Floor 2 Closet, Lobby Pantry"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-md"
                >
                  Add Location
                </button>
              </form>

              <div className="border border-slate-800/80 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                      <th className="p-3">Location Name</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-slate-500 italic">No locations configured yet.</td>
                      </tr>
                    ) : (
                      locations.map((loc) => (
                        <tr key={loc.id} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                          <td className="p-3 font-semibold text-slate-200">{loc.name}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                              {loc.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Catalog Items Manager */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-200">Add Item to Catalog</h2>
              <form onSubmit={handleCreateItem} className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Item SKU (Unique Code)</label>
                  <input
                    type="text"
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                    placeholder="e.g. COKE-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Item Name</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Coca-Cola Light"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Category</label>
                  <input
                    type="text"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    placeholder="e.g. Beverage, Snack, Towel"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Safety Stock Threshold (Alert level)</label>
                  <input
                    type="number"
                    value={newItemThreshold}
                    onChange={(e) => setNewItemThreshold(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-2.5 text-xs font-bold transition-all shadow-md mt-2"
                >
                  Create Tracked Item
                </button>
              </form>

              <div className="border border-slate-800/80 rounded-lg overflow-hidden mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500 italic">No tracked items in catalog yet.</td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={it.id} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                          <td className="p-3 font-mono font-bold text-slate-400">{it.sku}</td>
                          <td className="p-3 font-semibold text-slate-200">{it.name}</td>
                          <td className="p-3 text-slate-400">{it.category}</td>
                          <td className="p-3 text-right text-slate-300 font-mono">{it.safetyStockThreshold}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
