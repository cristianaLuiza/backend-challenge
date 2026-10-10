import { describe, expect, it } from 'bun:test';
import { canonicalJsonStringify, computeCanonicalPayloadHash } from './canonical-json';

describe('canonicalJsonStringify & computeCanonicalPayloadHash', () => {
  it('deve produzir o mesmo JSON canônico independentemente da ordem das chaves', () => {
    const obj1 = {
      roundId: 'round-1',
      providerId: 'provider-a',
      money: { currency: 'BRL', amount: '25.00' },
      kind: 'BET',
    };

    const obj2 = {
      kind: 'BET',
      money: { amount: '25.00', currency: 'BRL' },
      providerId: 'provider-a',
      roundId: 'round-1',
    };

    const str1 = canonicalJsonStringify(obj1);
    const str2 = canonicalJsonStringify(obj2);

    expect(str1).toBe(str2);
    expect(computeCanonicalPayloadHash(obj1)).toBe(computeCanonicalPayloadHash(obj2));
  });

  it('deve ignorar campos com valor undefined', () => {
    const obj1 = { a: 1, b: undefined };
    const obj2 = { a: 1 };

    expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
    expect(computeCanonicalPayloadHash(obj1)).toBe(computeCanonicalPayloadHash(obj2));
  });
});
