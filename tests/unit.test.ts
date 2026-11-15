import { describe, it, expect } from 'vitest';
import raw from '../src/content/profile.json';
import { ProfileSchema, BLANKS } from '../shared/schema';
import { sign, verify } from '../server/session';
import { toBase64, fromBase64 } from '../server/http';

describe('profile.json', () => {
  it('matches the schema, so the site can build', () => {
    const r = ProfileSchema.safeParse(raw);
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });
  it('rejects bad data', () => {
    expect(ProfileSchema.safeParse({ ...raw, name: '' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...raw, links: { ...raw.links, github: 'javascript:alert(1)' } }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...raw, gallery: [{ file: '../secret.jpg', caption: '' }] }).success).toBe(false);
  });
  it('has an "Add" template for every list', () => {
    for (const [key, value] of Object.entries(raw)) if (Array.isArray(value)) expect(BLANKS).toHaveProperty(key);
  });
});

describe('session tokens', () => {
  it('round-trips a payload', async () => {
    const t = await sign({ id: '42', login: 'me' }, 'secret', 60);
    expect(await verify(t, 'secret')).toMatchObject({ id: '42', login: 'me' });
  });
  it('rejects a wrong secret, a tampered token and an expired token', async () => {
    const t = await sign({ id: '42' }, 'secret', 60);
    expect(await verify(t, 'other')).toBeNull();
    const [body, sig] = t.split('.');
    const forged = btoa(JSON.stringify({ id: '1', exp: 9999999999 })).replace(/=+$/, '');
    expect(await verify(`${forged}.${sig}`, 'secret')).toBeNull();
    expect(await verify(`${body}.`, 'secret')).toBeNull();
    expect(await verify(await sign({ id: '42' }, 'secret', -5), 'secret')).toBeNull();
  });
});

describe('base64', () => {
  it('keeps non-English text intact', () => {
    const s = 'Sampath: సంపత్, naïve, 日本';
    expect(fromBase64(toBase64(s))).toBe(s);
  });
});
