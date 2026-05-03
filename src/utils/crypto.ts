import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const secret = process.env.DB_PASSWORD_SECRET;
  if (!secret) throw new Error('DB_PASSWORD_SECRET não definido no .env');
  return createHash('sha256').update(secret).digest();
}

export function encrypt(text: string): string {
  const key    = getKey();
  const iv     = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 2) return ciphertext; // fallback — valor em texto puro
  const [ivHex, encHex] = parts;
  const key      = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  const dec      = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}
