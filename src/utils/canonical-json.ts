import { createHash } from 'node:crypto';

/**
 * Serializa um objeto em JSON canônico com chaves ordenadas recursivamente.
 * Garante determinismo na geração de hashes independentemente da ordem das propriedades recebidas.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`);

  return '{' + pairs.join(',') + '}';
}

/**
 * Calcula o hash SHA-256 do JSON canônico de um payload de negócio.
 */
export function computeCanonicalPayloadHash(data: unknown): string {
  const canonicalJson = canonicalJsonStringify(data);
  return createHash('sha256').update(canonicalJson).digest('hex');
}