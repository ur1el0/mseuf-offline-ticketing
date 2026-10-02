import { apiRequest } from './apiClient';
import {
  getScannerDeviceId,
  loadPendingScans,
  markScansSynced,
  type PendingScan,
  type ServerScanOutcome,
} from './offlineScanQueue';

const BATCH_SIZE = 50;

type SyncResponse = {
  acknowledged_scan_ids: string[];
  outcomes: ServerScanOutcome[];
};

export type ScanSyncSummary = {
  accepted: number;
  rejected: number;
  reasons: string[];
  outcomes: ServerScanOutcome[];
};

export async function syncPendingScans(
  token: string,
  serverUrl: string,
  staffId: number,
): Promise<ScanSyncSummary> {
  const deviceId = await getScannerDeviceId();
  const summary: ScanSyncSummary = { accepted: 0, rejected: 0, reasons: [], outcomes: [] };

  while (true) {
    const pending = await loadPendingScans(serverUrl, staffId);
    if (pending.length === 0) return summary;

    const batch = pending.slice(0, BATCH_SIZE);
    const response = await apiRequest<unknown>('/sync/batch', {
      method: 'POST',
      token,
      baseUrl: serverUrl,
      body: { device_id: deviceId, scans: batch },
    });
    const outcomes = validateSyncResponse(response, batch);
    await markScansSynced(serverUrl, staffId, outcomes);
    summary.outcomes.push(...outcomes);

    for (const outcome of outcomes) {
      if (outcome.decision === 'accepted') {
        summary.accepted++;
      } else {
        summary.rejected++;
        if (outcome.reason_code && !summary.reasons.includes(outcome.reason_code)) {
          summary.reasons.push(outcome.reason_code);
        }
      }
    }
  }
}

function validateSyncResponse(value: unknown, batch: PendingScan[]): ServerScanOutcome[] {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The event server returned an invalid sync result. Scans remain saved on this device.');
  }

  const payload = value as Partial<SyncResponse>;
  if (!Array.isArray(payload.acknowledged_scan_ids) || !Array.isArray(payload.outcomes)) {
    throw new Error('The event server did not return scan decisions. Scans remain saved on this device.');
  }

  const expectedIds = new Set(batch.map((scan) => scan.scan_id));
  const acknowledgedIds = new Set(payload.acknowledged_scan_ids.filter((id): id is string => typeof id === 'string'));
  if (acknowledgedIds.size !== batch.length || batch.some((scan) => !acknowledgedIds.has(scan.scan_id))) {
    throw new Error('The event server acknowledged an incomplete scan batch. Scans remain saved on this device.');
  }

  const outcomes = payload.outcomes as unknown[];
  if (outcomes.length !== batch.length) {
    throw new Error('The event server returned an incomplete scan result. Scans remain saved on this device.');
  }

  const byId = new Map<string, ServerScanOutcome>();
  for (const value of outcomes) {
    if (typeof value !== 'object' || value === null) {
      throw new Error('The event server returned an invalid scan decision. Scans remain saved on this device.');
    }
    const outcome = value as Partial<ServerScanOutcome>;
    if (typeof outcome.scan_id !== 'string'
      || !expectedIds.has(outcome.scan_id)
      || (outcome.decision !== 'accepted' && outcome.decision !== 'rejected')
      || !(typeof outcome.reason_code === 'string' || outcome.reason_code === null)) {
      throw new Error('The event server returned an invalid scan decision. Scans remain saved on this device.');
    }
    byId.set(outcome.scan_id, outcome as ServerScanOutcome);
  }
  if (byId.size !== batch.length) {
    throw new Error('The event server returned duplicate scan decisions. Scans remain saved on this device.');
  }

  return batch.map((scan) => byId.get(scan.scan_id)!);
}
