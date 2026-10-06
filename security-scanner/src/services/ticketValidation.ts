import type { GateManifest } from './gateManifest';
import { createRotatingTicketCode } from './totp';
import { validateTicketQrCore, type TicketQrCheck } from './ticketValidationCore';

export type { TicketQrCheck } from './ticketValidationCore';

export async function validateTicketQr(
  payload: string,
  manifest: GateManifest,
  gateId: number,
  currentTimeMs: number = Date.now(),
): Promise<TicketQrCheck> {
  return validateTicketQrCore(
    payload,
    manifest,
    gateId,
    currentTimeMs,
    async (secret, timeMs) => createRotatingTicketCode(secret, timeMs),
  );
}
