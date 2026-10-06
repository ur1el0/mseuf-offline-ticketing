import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { validateTicketQrCore } from '../src/services/ticketValidationCore.ts';
import { getTicketRejectionCopy } from '../src/services/ticketRejectionCopy.ts';

const TICKET_SECRET = '0123456789abcdef0123456789abcdef01234567';
const CURRENT_TIME = 1_800_000_000_000;
const CURRENT_STEP = Math.floor(CURRENT_TIME / 30_000);
const VALID_CODE = createTotpCode(TICKET_SECRET, CURRENT_STEP);

function makeManifest({
  gateId = 41,
  eventStatus = 'scheduled',
  ticketGateId = gateId,
  ticketStatus = 'unclaimed',
  ticketId = 123,
} = {}) {
  return {
    gate_id: gateId,
    event_status: eventStatus,
    manifest_version: 3,
    tickets: [{
      ticket_id: ticketId,
      student_number: 'A23-12345',
      totp_secret: TICKET_SECRET,
      gate_id: ticketGateId,
      status: ticketStatus,
    }],
  };
}

function makePayload({ ticketId = 123, step = CURRENT_STEP, code = VALID_CODE } = {}) {
  return `EUEVENT1:${ticketId}:${step}:${code}`;
}

async function generateCode(secret, timeMs) {
  return { code: createTotpCode(secret, Math.floor(timeMs / 30_000)) };
}

function createTotpCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac('sha1', Buffer.from(secret, 'hex')).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(binaryCode % 1_000_000).padStart(6, '0');
}

test('accepts a current rotating code for a ticket on the selected gate', async () => {
  const result = await validateTicketQrCore(
    makePayload(), makeManifest(), 41, CURRENT_TIME, generateCode,
  );

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.ticket.ticket_id, 123);
    assert.equal(result.timeStep, CURRENT_STEP);
  }
});

test('rejects a ticket absent from this gate-scoped manifest', async () => {
  const result = await validateTicketQrCore(
    makePayload(), { ...makeManifest(), tickets: [] }, 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'unknown_ticket' });
  const copy = getTicketRejectionCopy(result.reason);
  assert.match(copy.detail, /event and gate printed on the ticket/i);
  assert.match(copy.detail, /direct the student to the listed entrance/i);
  assert.match(copy.detail, /pause entry/i);
});

test('rejects a ticket whose gate differs from the scanner gate', async () => {
  const result = await validateTicketQrCore(
    makePayload(), makeManifest({ ticketGateId: 42 }), 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'wrong_gate' });
  assert.match(getTicketRejectionCopy(result.reason).detail, /Do not admit them at this gate/i);
});

test('rejects a manifest prepared for a different scanner gate', async () => {
  const result = await validateTicketQrCore(
    makePayload(), makeManifest(), 42, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'wrong_gate' });
});

test('rejects a ticket for an inactive event', async () => {
  const result = await validateTicketQrCore(
    makePayload(), makeManifest({ eventStatus: 'cancelled' }), 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'event_inactive' });
});

test('rejects a ticket already marked as claimed in the saved manifest', async () => {
  const result = await validateTicketQrCore(
    makePayload(), makeManifest({ ticketStatus: 'claimed' }), 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'ticket_used' });
});

test('rejects a QR from a different 30-second slot', async () => {
  const result = await validateTicketQrCore(
    makePayload({ step: CURRENT_STEP - 1 }), makeManifest(), 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'expired' });
});

test('rejects an incorrect rotating code in the current slot', async () => {
  const result = await validateTicketQrCore(
    makePayload({ code: '654321' }), makeManifest(), 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'invalid_code' });
});

test('rejects malformed QR payloads before ticket lookup', async () => {
  const result = await validateTicketQrCore(
    'not-an-euevent-ticket', makeManifest(), 41, CURRENT_TIME, generateCode,
  );

  assert.deepEqual(result, { valid: false, reason: 'invalid_format' });
});

test('a screenshot of a valid QR remains valid during its current 30-second slot', async () => {
  const screenshotPayload = makePayload();
  const result = await validateTicketQrCore(
    screenshotPayload, makeManifest(), 41, CURRENT_TIME + 10_000, generateCode,
  );

  assert.equal(result.valid, true);
});
