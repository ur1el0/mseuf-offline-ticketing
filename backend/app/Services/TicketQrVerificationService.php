<?php

namespace App\Services;

use App\Models\Ticket;

class TicketQrVerificationService
{
    public function matches(Ticket $ticket, int $timeStep, string $code): bool
    {
        $secret = $ticket->totp_secret;

        if (! is_string($secret) || ! preg_match('/^[a-f0-9]{40}$/i', $secret) || ! preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $binarySecret = hex2bin($secret);
        if ($binarySecret === false) {
            return false;
        }

        $counter = pack('N2', intdiv($timeStep, 4_294_967_296), $timeStep % 4_294_967_296);
        $digest = hash_hmac('sha1', $counter, $binarySecret, true);
        $offset = ord($digest[strlen($digest) - 1]) & 0x0F;
        $binaryCode = unpack('N', substr($digest, $offset, 4))[1] & 0x7FFFFFFF;
        $expectedCode = str_pad((string) ($binaryCode % 1_000_000), 6, '0', STR_PAD_LEFT);

        return hash_equals($expectedCode, $code);
    }
}
