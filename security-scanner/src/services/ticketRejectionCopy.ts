import type { TicketQrReason } from './ticketValidationCore';

export type TicketRejectionCopy = { title: string; detail: string };

const rejectionCopy: Record<TicketQrReason, TicketRejectionCopy> = {
  invalid_format: {
    title: 'Unrecognized ticket QR',
    detail: 'The QR code is not in the EUEvent ticket format. Ask the student to open the live ticket in the app.',
  },
  unknown_ticket: {
    title: 'Ticket not on this gate manifest',
    detail: 'Check that the event and gate printed on the ticket match this scanner. If they differ, direct the student to the listed entrance. If they match, pause entry and ask the event lead to refresh this gate’s manifest when connected.',
  },
  wrong_gate: {
    title: 'Ticket belongs to another gate',
    detail: 'Direct the student to the gate printed on their ticket. Do not admit them at this gate.',
  },
  event_inactive: {
    title: 'Event is not accepting entry',
    detail: 'The saved event status does not allow entry. Ask the event lead before proceeding.',
  },
  ticket_used: {
    title: 'Ticket already used',
    detail: 'This saved manifest marks the ticket as already claimed. Do not admit it again.',
  },
  expired: {
    title: 'Rotating code expired',
    detail: 'This QR is outside the scanner’s current 30-second time slot. Check that the student phone uses automatic date and time, then scan the live QR again.',
  },
  invalid_code: {
    title: 'Invalid rotating code',
    detail: 'The QR code did not match a valid EUEvent rotating ticket.',
  },
};

export function getTicketRejectionCopy(reason: TicketQrReason): TicketRejectionCopy {
  return rejectionCopy[reason];
}
