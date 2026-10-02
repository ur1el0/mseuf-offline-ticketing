import {
  AESEncryptionKey,
  AESSealedData,
  CryptoDigestAlgorithm,
  aesDecryptAsync,
  aesEncryptAsync,
  digestStringAsync,
} from 'expo-crypto';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export type PendingScan = {
  scan_id: string;
  ticket_id: number;
  gate_id: number;
  scanned_at: number;
  is_override: false;
  event_configuration_version: number;
  code_step: number;
  code: string;
};

export type ServerScanOutcome = {
  scan_id: string;
  decision: 'accepted' | 'rejected';
  reason_code: string | null;
};

type QueueRow = { scan_id: string; encrypted_payload: string };
type ExistingScanRow = { scan_id: string; sync_state: string; server_decision: string | null; server_reason_code: string | null };

const DATABASE_NAME = 'euevent-scan-queue.db';
const TABLE_NAME = 'offline_scan_queue';
const ENCRYPTION_KEY = 'euevent-offline-scan-aes-key';
const DEVICE_ID_KEY = 'euevent-scanner-device-id';
const TICKET_FINGERPRINT_SALT_KEY = 'euevent-ticket-fingerprint-salt';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let encryptionKeyPromise: Promise<AESEncryptionKey | null> | null = null;

export async function getScannerDeviceId(): Promise<string> {
  const savedId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (savedId && /^[0-9a-f-]{36}$/i.test(savedId)) {
    return savedId;
  }

  const deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function savePendingScan(
  serverUrl: string,
  staffId: number,
  scan: PendingScan,
): Promise<boolean> {
  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);
  const ticketFingerprint = await makeTicketFingerprint(scopeId, scan.ticket_id);
  const existing = await database.getFirstAsync<ExistingScanRow>(
    `SELECT scan_id, sync_state, server_decision, server_reason_code
     FROM ${TABLE_NAME} WHERE scope_id = ? AND ticket_fingerprint = ?`,
    scopeId,
    ticketFingerprint,
  );
  if (existing) {
    return false;
  }

  const encryptionKey = await getEncryptionKey();
  const sealed = await aesEncryptAsync(new TextEncoder().encode(JSON.stringify(scan)), encryptionKey);
  const encryptedPayload = await sealed.combined('base64');
  if (typeof encryptedPayload !== 'string') {
    throw new Error('Could not encrypt the pending scan.');
  }

  const result = await database.runAsync(
    `INSERT OR IGNORE INTO ${TABLE_NAME}
       (scope_id, scan_id, ticket_fingerprint, encrypted_payload, sync_state)
     VALUES (?, ?, ?, ?, 'pending')`,
    scopeId,
    scan.scan_id,
    ticketFingerprint,
    encryptedPayload,
  );

  return result.changes === 1;
}

export async function hasScannedTicket(serverUrl: string, staffId: number, ticketId: number): Promise<boolean> {
  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);
  const ticketFingerprint = await makeTicketFingerprint(scopeId, ticketId);
  const row = await database.getFirstAsync<{ scan_id: string }>(
    `SELECT scan_id FROM ${TABLE_NAME} WHERE scope_id = ? AND ticket_fingerprint = ? LIMIT 1`,
    scopeId,
    ticketFingerprint,
  );
  return row !== null;
}

export async function loadPendingScans(serverUrl: string, staffId: number): Promise<PendingScan[]> {
  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);
  const rows = await database.getAllAsync<QueueRow>(
    `SELECT scan_id, encrypted_payload FROM ${TABLE_NAME}
     WHERE scope_id = ? AND sync_state = 'pending' ORDER BY rowid`,
    scopeId,
  );
  const encryptionKey = await getEncryptionKeyIfAvailable();
  if (!encryptionKey && rows.length > 0) {
    throw new Error('The key for pending scans is missing. Keep this app installed and contact an administrator.');
  }
  if (!encryptionKey) {
    return [];
  }

  const pending: PendingScan[] = [];
  for (const row of rows) {
    try {
      const sealed = AESSealedData.fromCombined(row.encrypted_payload);
      const plaintext = await aesDecryptAsync(sealed, encryptionKey, { output: 'bytes' });
      const scan: unknown = JSON.parse(new TextDecoder().decode(plaintext as Uint8Array));
      if (!isPendingScan(scan) || scan.scan_id !== row.scan_id) {
        throw new Error('A saved scan entry is invalid.');
      }
      pending.push(scan);
    } catch {
      throw new Error('A pending scan could not be decrypted. Keep this app installed and contact an administrator.');
    }
  }

  return pending;
}

export async function markScansSynced(
  serverUrl: string,
  staffId: number,
  outcomes: ServerScanOutcome[],
): Promise<void> {
  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);
  await database.withTransactionAsync(async () => {
    for (const outcome of outcomes) {
      await database.runAsync(
        `UPDATE ${TABLE_NAME}
         SET encrypted_payload = '', sync_state = 'synced', server_decision = ?, server_reason_code = ?
         WHERE scope_id = ? AND scan_id = ?`,
        outcome.decision,
        outcome.reason_code,
        scopeId,
        outcome.scan_id,
      );
    }
  });
}

export async function countPendingScans(serverUrl: string, staffId: number): Promise<number> {
  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${TABLE_NAME} WHERE scope_id = ? AND sync_state = 'pending'`,
    scopeId,
  );
  return Number(row?.count ?? 0);
}

function isPendingScan(value: unknown): value is PendingScan {
  if (typeof value !== 'object' || value === null) return false;
  const scan = value as Partial<PendingScan>;
  return typeof scan.scan_id === 'string'
    && /^[0-9a-f-]{36}$/i.test(scan.scan_id)
    && Number.isInteger(scan.ticket_id)
    && Number.isInteger(scan.gate_id)
    && Number.isInteger(scan.scanned_at)
    && scan.is_override === false
    && Number.isInteger(scan.event_configuration_version)
    && Number.isInteger(scan.code_step)
    && typeof scan.code === 'string'
    && /^\d{6}$/.test(scan.code);
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    throw new Error('Offline scan storage is available in the iOS and Android scanner app.');
  }
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          scope_id TEXT NOT NULL,
          scan_id TEXT NOT NULL,
          ticket_fingerprint TEXT NOT NULL,
          encrypted_payload TEXT NOT NULL,
          sync_state TEXT NOT NULL CHECK(sync_state IN ('pending', 'synced')),
          server_decision TEXT NULL CHECK(server_decision IN ('accepted', 'rejected')),
          server_reason_code TEXT NULL,
          PRIMARY KEY (scope_id, scan_id),
          UNIQUE (scope_id, ticket_fingerprint)
        );
        CREATE INDEX IF NOT EXISTS offline_scan_queue_pending_idx
          ON ${TABLE_NAME} (scope_id, sync_state);
      `);
      return database;
    })();
  }
  try {
    return await databasePromise;
  } catch (error) {
    databasePromise = null;
    throw error;
  }
}

async function getEncryptionKey(): Promise<AESEncryptionKey> {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = (async () => {
      const savedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY);
      if (savedKey) return AESEncryptionKey.import(savedKey, 'hex');
      const key = await AESEncryptionKey.generate(256);
      await SecureStore.setItemAsync(ENCRYPTION_KEY, await key.encoded('hex'));
      return key;
    })();
  }
  try {
    const key = await encryptionKeyPromise;
    if (!key) throw new Error('Could not access the scan queue key.');
    return key;
  } catch (error) {
    encryptionKeyPromise = null;
    throw error;
  }
}

async function getEncryptionKeyIfAvailable(): Promise<AESEncryptionKey | null> {
  if (encryptionKeyPromise) return encryptionKeyPromise;
  const savedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY);
  if (!savedKey) return null;
  encryptionKeyPromise = AESEncryptionKey.import(savedKey, 'hex');
  return encryptionKeyPromise;
}

async function makeScopeId(serverUrl: string, staffId: number): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${serverUrl}\u0000${staffId}`);
}

async function makeTicketFingerprint(scopeId: string, ticketId: number): Promise<string> {
  let salt = await SecureStore.getItemAsync(TICKET_FINGERPRINT_SALT_KEY);
  if (!salt) {
    salt = Crypto.randomUUID();
    await SecureStore.setItemAsync(TICKET_FINGERPRINT_SALT_KEY, salt);
  }

  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}\u0000${scopeId}\u0000${ticketId}`);
}
