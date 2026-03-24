import { randomBytes, randomUUID } from 'crypto';

function createRandomHex(bytes = 16): string {
  const buffer = new Uint8Array(bytes);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buffer);
  } else {
    buffer.set(randomBytes(bytes));
  }

  return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function createPrefixedId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? randomUUID?.() ?? createRandomHex();
  return `${prefix}_${uuid}`;
}
