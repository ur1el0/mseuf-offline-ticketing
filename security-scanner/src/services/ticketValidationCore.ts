import type { GateManifest, GateManifestTicket } from './gateManifest';

const PERIOD_MILLISECONDS = 30_000;
const ALLOWED_CLOCK_DRIFT_STEPS = 0;

export type TicketQrReason =
  | 'invalid_format'
  | 'unknown_ticket'
  | 'wrong_gate'
  | 'event_inactive'
  | 'ticket_used'
  | 'expired'
  | 'invalid_code';

export type TicketQrCheck =
  | { valid: true; ticket: GateManifestTicket; timeStep: number; code: string }
  | { valid: false; reason: TicketQrReason };

type CodeGenerator = (secret: string, timeMs: number) => Promise<{ code: string }>;

export async function validateTicketQrCore(
  payload: string,
  manifest: GateManifest,
  gateId: number,
  currentTimeMs: number,
  generateCode: CodeGenerator,
): Promise<TicketQrCheck> {
  const match = /^EUEVENT1:(\d{1,12}):(\d{1,12}):(\d{6})$/.exec(payload);
  if (!match) {
    return { valid: false, reason: 'invalid_format' };
  }

  const ticketId = Number(match[1]);
  const step = Number(match[2]);
  const code = match[3];
  if (!Number.isSafeInteger(ticketId) || ticketId < 1 || !Number.isSafeInteger(step) || step < 1) {
    return { valid: false, reason: 'invalid_format' };
  }

  const ticket = manifest.tickets.find((entry) => entry.ticket_id === ticketId);
  if (!ticket) {
    return { valid: false, reason: 'unknown_ticket' };
  }
  if (ticket.gate_id !== gateId || manifest.gate_id !== gateId) {
    return { valid: false, reason: 'wrong_gate' };
  }
  if (manifest.event_status !== 'scheduled' && manifest.event_status !== 'in_progress') {
    return { valid: false, reason: 'event_inactive' };
  }
  if (ticket.status === 'claimed') {
    return { valid: false, reason: 'ticket_used' };
  }

  const currentStep = Math.floor(currentTimeMs / PERIOD_MILLISECONDS);
  if (Math.abs(step - currentStep) > ALLOWED_CLOCK_DRIFT_STEPS) {
    return { valid: false, reason: 'expired' };
  }

  const expected = await generateCode(ticket.totp_secret, step * PERIOD_MILLISECONDS);
  if (expected.code !== code) {
    return { valid: false, reason: 'invalid_code' };
  }

  return { valid: true, ticket, timeStep: step, code };
}
