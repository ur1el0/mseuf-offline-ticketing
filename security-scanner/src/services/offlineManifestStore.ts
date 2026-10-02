import {
  AESEncryptionKey,
  AESSealedData,
  CryptoDigestAlgorithm,
  aesDecryptAsync,
  aesEncryptAsync,
  digestStringAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { AssignedGate } from './assignedGates';
import type { GateManifest } from './gateManifest';

export type OfflineGateManifest = {
  assignment: AssignedGate;
  manifest: GateManifest;
  downloadedAt: string;
};

export type CachedManifestSummary = {
  manifestVersion: number;
  ticketCount: number;
  downloadedAt: string;
};

type ManifestRow = {
  gate_id: number;
  encrypted_payload: string;
};

const DATABASE_NAME = 'euevent-security-cache.db';
const ENCRYPTION_KEY = 'euevent-offline-manifest-aes-key';
const TABLE_NAME = 'offline_gate_manifests';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let encryptionKeyPromise: Promise<AESEncryptionKey | null> | null = null;

export async function saveOfflineGateManifest(
  serverUrl: string,
  staffId: number,
  assignment: AssignedGate,
  manifest: GateManifest,
): Promise<OfflineGateManifest> {
  if (manifest.gate_id !== assignment.gate_id) {
    throw new Error('The manifest does not match this gate assignment.');
  }

  const snapshot: OfflineGateManifest = {
    assignment,
    manifest,
    downloadedAt: new Date().toISOString(),
  };
  const encryptionKey = await getEncryptionKey(true);

  if (!encryptionKey) {
    throw new Error('Could not create a key for the encrypted offline cache.');
  }

  const encrypted = await aesEncryptAsync(
    new TextEncoder().encode(JSON.stringify(snapshot)),
    encryptionKey,
  );
  const encryptedPayload = await encrypted.combined('base64');

  if (typeof encryptedPayload !== 'string') {
    throw new Error('Could not encode the encrypted gate manifest.');
  }

  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);

  await database.runAsync(
    `INSERT INTO ${TABLE_NAME} (scope_id, gate_id, encrypted_payload)
     VALUES (?, ?, ?)
     ON CONFLICT(scope_id, gate_id) DO UPDATE SET encrypted_payload = excluded.encrypted_payload`,
    scopeId,
    assignment.gate_id,
    encryptedPayload,
  );

  return snapshot;
}

export async function loadOfflineGateManifests(
  serverUrl: string,
  staffId: number,
): Promise<OfflineGateManifest[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  const database = await getDatabase();
  const scopeId = await makeScopeId(serverUrl, staffId);
  const rows = await database.getAllAsync<ManifestRow>(
    `SELECT gate_id, encrypted_payload FROM ${TABLE_NAME} WHERE scope_id = ? ORDER BY gate_id`,
    scopeId,
  );

  if (rows.length === 0) {
    return [];
  }

  const encryptionKey = await getEncryptionKey(false);

  if (!encryptionKey) {
    return [];
  }

  const snapshots: OfflineGateManifest[] = [];

  for (const row of rows) {
    try {
      const sealedData = AESSealedData.fromCombined(row.encrypted_payload);
      const plaintext = await aesDecryptAsync(sealedData, encryptionKey, { output: 'bytes' });
      const snapshot = JSON.parse(new TextDecoder().decode(plaintext as Uint8Array)) as OfflineGateManifest;

      if (snapshot.manifest.gate_id === row.gate_id && snapshot.assignment.gate_id === row.gate_id) {
        snapshots.push(snapshot);
      } else {
        await deleteGateManifest(database, scopeId, row.gate_id);
      }
    } catch {
      await deleteGateManifest(database, scopeId, row.gate_id);
    }
  }

  return snapshots;
}

export function summarizeOfflineGateManifest(snapshot: OfflineGateManifest): CachedManifestSummary {
  return {
    manifestVersion: snapshot.manifest.manifest_version,
    ticketCount: snapshot.manifest.tickets.length,
    downloadedAt: snapshot.downloadedAt,
  };
}

export async function clearOfflineGateManifests(): Promise<void> {
  try {
    const database = await getDatabase();
    await database.execAsync(`DELETE FROM ${TABLE_NAME}`);
  } finally {
    encryptionKeyPromise = null;
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY);
  }
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    throw new Error('Encrypted offline manifests are available in the iOS and Android scanner app.');
  }

  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          scope_id TEXT NOT NULL,
          gate_id INTEGER NOT NULL,
          encrypted_payload TEXT NOT NULL,
          PRIMARY KEY (scope_id, gate_id)
        );
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

async function getEncryptionKey(createIfMissing: boolean): Promise<AESEncryptionKey | null> {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = (async () => {
      const savedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY);

      if (savedKey) {
        return AESEncryptionKey.import(savedKey, 'hex');
      }

      if (!createIfMissing) {
        return null;
      }

      const encryptionKey = await AESEncryptionKey.generate(256);
      await SecureStore.setItemAsync(ENCRYPTION_KEY, await encryptionKey.encoded('hex'));
      return encryptionKey;
    })();
  }

  try {
    return await encryptionKeyPromise;
  } catch (error) {
    encryptionKeyPromise = null;
    throw error;
  }
}

async function makeScopeId(serverUrl: string, staffId: number): Promise<string> {
  return digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `${serverUrl}\u0000${staffId}`,
  );
}

async function deleteGateManifest(
  database: SQLite.SQLiteDatabase,
  scopeId: string,
  gateId: number,
): Promise<void> {
  await database.runAsync(
    `DELETE FROM ${TABLE_NAME} WHERE scope_id = ? AND gate_id = ?`,
    scopeId,
    gateId,
  );
}
