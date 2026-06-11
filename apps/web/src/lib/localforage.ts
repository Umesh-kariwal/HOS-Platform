import localforage from 'localforage';

localforage.config({
  name: 'hos-platform-client',
  storeName: 'offline_sync_outbox',
  description: 'Stores checkout and check-in transactions during network outages',
});

export interface OfflineSyncRecord {
  id: string;
  action: string;
  payload: Record<string, any>;
  timestamp: number;
}

export async function queueOfflineAction(action: string, payload: Record<string, any>): Promise<void> {
  const id = `action_${Date.now()}`;
  const record: OfflineSyncRecord = {
    id,
    action,
    payload,
    timestamp: Date.now(),
  };
  await localforage.setItem(id, record);
}

export async function getQueuedActions(): Promise<OfflineSyncRecord[]> {
  const keys = await localforage.keys();
  const records: OfflineSyncRecord[] = [];
  for (const key of keys) {
    if (key.startsWith('action_')) {
      const record = await localforage.getItem<OfflineSyncRecord>(key);
      if (record) records.push(record);
    }
  }
  return records.sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearQueuedAction(id: string): Promise<void> {
  await localforage.removeItem(id);
}
