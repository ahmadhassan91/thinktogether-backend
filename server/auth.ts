import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function createInviteToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
