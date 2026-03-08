import * as Crypto from 'expo-crypto';
import { ADMIN_PIN_LENGTH, EMPLOYEE_PIN_LENGTH } from '../../constants/app';

const SALT_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const BLOCK_SIZE_BYTES = 64;
const PBKDF2_ITERATIONS = 10000;
const encoder = new TextEncoder();

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length.');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toInt32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    new Uint8Array(data),
  );
  return new Uint8Array(digest);
}

async function hmacSha256(
  key: Uint8Array,
  message: Uint8Array,
): Promise<Uint8Array> {
  let normalizedKey = key;
  if (normalizedKey.length > BLOCK_SIZE_BYTES) {
    normalizedKey = await sha256(normalizedKey);
  }
  if (normalizedKey.length < BLOCK_SIZE_BYTES) {
    const padded = new Uint8Array(BLOCK_SIZE_BYTES);
    padded.set(normalizedKey);
    normalizedKey = padded;
  }

  const ipad = new Uint8Array(BLOCK_SIZE_BYTES);
  const opad = new Uint8Array(BLOCK_SIZE_BYTES);

  for (let i = 0; i < BLOCK_SIZE_BYTES; i += 1) {
    const keyByte = normalizedKey[i];
    ipad[i] = keyByte ^ 0x36;
    opad[i] = keyByte ^ 0x5c;
  }

  const innerHash = await sha256(concatBytes(ipad, message));
  return sha256(concatBytes(opad, innerHash));
}

async function pbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
): Promise<Uint8Array> {
  const pass = encoder.encode(password);
  const hashLength = 32;
  const blockCount = Math.ceil(keyLength / hashLength);
  const output = new Uint8Array(keyLength);

  for (let block = 1; block <= blockCount; block += 1) {
    let u = await hmacSha256(pass, concatBytes(salt, toInt32BE(block)));
    const t = new Uint8Array(u);

    for (let i = 1; i < iterations; i += 1) {
      u = await hmacSha256(pass, u);
      for (let j = 0; j < hashLength; j += 1) {
        t[j] ^= u[j];
      }
    }

    const offset = (block - 1) * hashLength;
    const length = Math.min(hashLength, keyLength - offset);
    output.set(t.slice(0, length), offset);
  }

  return output;
}

function validatePin(pin: string) {
  const expectedLength = Math.max(ADMIN_PIN_LENGTH, EMPLOYEE_PIN_LENGTH);
  if (!new RegExp(`^\\d{${expectedLength}}$`).test(pin)) {
    throw new Error(`PIN must be exactly ${expectedLength} numeric digits.`);
  }
}

export async function hashPin(pin: string): Promise<string> {
  validatePin(pin);
  const salt = new Uint8Array(Crypto.getRandomBytes(SALT_BYTES));
  const derivedKey = await pbkdf2Sha256(
    pin,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH_BYTES,
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(
    derivedKey,
  )}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('pbkdf2_sha256$')) {
    return false;
  }

  validatePin(pin);

  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  const derived = await pbkdf2Sha256(pin, salt, iterations, expected.length);
  return timingSafeEqual(derived, expected);
}
