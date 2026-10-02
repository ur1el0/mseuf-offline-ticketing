import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isStudentTicket, type StudentTicket } from './studentTickets';

const INDEX_PREFIX = 'euevent-student-ticket-index';
const TICKET_PREFIX = 'euevent-student-ticket';

async function getScope(serverUrl: string, studentId: number): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    serverUrl + '\u0000' + studentId,
  );
}

function makeIndexKey(scope: string): string {
  return INDEX_PREFIX + '-' + scope;
}

function makeTicketKey(scope: string, ticketId: number): string {
  return TICKET_PREFIX + '-' + scope + '-' + ticketId;
}

async function readTicketIds(indexKey: string): Promise<number[]> {
  const savedIds = await SecureStore.getItemAsync(indexKey);
  if (!savedIds) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(savedIds);
    return Array.isArray(parsed)
      ? parsed.filter((ticketId): ticketId is number => Number.isInteger(ticketId) && ticketId > 0)
      : [];
  } catch {
    return [];
  }
}

export async function saveStudentTicketCache(
  serverUrl: string,
  studentId: number,
  tickets: StudentTicket[],
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const scope = await getScope(serverUrl, studentId);
  const indexKey = makeIndexKey(scope);
  const previousIds = await readTicketIds(indexKey);
  const ticketIds = tickets.map((ticket) => ticket.id);

  for (const ticket of tickets) {
    const serialized = JSON.stringify(ticket);
    if (serialized.length > 1800) {
      throw new Error('A ticket is too large to save securely on this device.');
    }
    await SecureStore.setItemAsync(makeTicketKey(scope, ticket.id), serialized);
  }

  const serializedIds = JSON.stringify(ticketIds);
  if (serializedIds.length > 1800) {
    throw new Error('Too many tickets to index in secure device storage.');
  }

  await SecureStore.setItemAsync(indexKey, serializedIds);

  await Promise.all(previousIds
    .filter((ticketId) => !ticketIds.includes(ticketId))
    .map((ticketId) => SecureStore.deleteItemAsync(makeTicketKey(scope, ticketId))));
}

export async function loadStudentTicketCache(
  serverUrl: string,
  studentId: number,
): Promise<StudentTicket[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  const scope = await getScope(serverUrl, studentId);
  const indexKey = makeIndexKey(scope);
  const ticketIds = await readTicketIds(indexKey);
  const tickets = await Promise.all(ticketIds.map(async (ticketId) => {
    const serialized = await SecureStore.getItemAsync(makeTicketKey(scope, ticketId));
    if (!serialized) {
      return null;
    }

    try {
      const ticket: unknown = JSON.parse(serialized);
      return isStudentTicket(ticket) && ticket.id === ticketId ? ticket : null;
    } catch {
      return null;
    }
  }));

  return tickets.filter((ticket): ticket is StudentTicket => ticket !== null);
}

export async function clearStudentTicketCache(serverUrl: string, studentId: number): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const scope = await getScope(serverUrl, studentId);
  const indexKey = makeIndexKey(scope);
  const ticketIds = await readTicketIds(indexKey);

  await Promise.all([
    SecureStore.deleteItemAsync(indexKey),
    ...ticketIds.map((ticketId) => SecureStore.deleteItemAsync(makeTicketKey(scope, ticketId))),
  ]);
}
