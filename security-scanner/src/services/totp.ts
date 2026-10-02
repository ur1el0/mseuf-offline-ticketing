import * as Crypto from 'expo-crypto';

const PERIOD_SECONDS = 30;
const CODE_DIGITS = 6;

export type RotatingTicketCode = {
  step: number;
  code: string;
};

export async function createRotatingTicketCode(
  hexSecret: string,
  currentTimeMs: number = Date.now(),
): Promise<RotatingTicketCode> {
  const secret = decodeHexSecret(hexSecret);
  const step = Math.floor(currentTimeMs / 1000 / PERIOD_SECONDS);
  const counter = new Uint8Array(8);
  let remaining = step;

  for (let index = counter.length - 1; index >= 0; index--) {
    counter[index] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }

  const digest = await hmacSha1(secret, counter);
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  const code = String(binaryCode % (10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0');

  return { step, code };
}

export function createTicketQrPayload(ticketId: number, step: number, code: string): string {
  return 'EUEVENT1:' + ticketId + ':' + step + ':' + code;
}

function decodeHexSecret(secret: string): Uint8Array {
  if (!/^[a-f0-9]{40}$/i.test(secret)) {
    throw new Error('This ticket has an invalid rotating-code secret.');
  }

  return Uint8Array.from(
    Array.from({ length: secret.length / 2 }, (_, index) => Number.parseInt(secret.slice(index * 2, index * 2 + 2), 16)),
  );
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const blockSize = 64;
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  const innerInput = new Uint8Array(blockSize + message.length);
  const outerInput = new Uint8Array(blockSize + 20);

  for (let index = 0; index < blockSize; index++) {
    innerInput[index] = paddedKey[index] ^ 0x36;
    outerInput[index] = paddedKey[index] ^ 0x5c;
  }

  innerInput.set(message, blockSize);
  const innerDigest = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, innerInput));
  outerInput.set(innerDigest, blockSize);

  return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, outerInput));
}
