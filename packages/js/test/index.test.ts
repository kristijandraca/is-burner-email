import { describe, it, expect, beforeEach } from 'vitest';
import {
  check,
  isBurner,
  addToBlacklist,
  addToWhitelist,
  removeFromBlacklist,
  removeFromWhitelist,
  getListSizes,
} from '../src/index.js';

describe('extractDomain (via check)', () => {
  it('returns invalid-email for non-strings', () => {
    // @ts-expect-error intentional
    expect(check(null).reason).toBe('invalid-email');
    // @ts-expect-error intentional
    expect(check(undefined).reason).toBe('invalid-email');
    // @ts-expect-error intentional
    expect(check(42).reason).toBe('invalid-email');
  });

  it('rejects emails without @', () => {
    expect(check('not-an-email').reason).toBe('invalid-email');
  });

  it('rejects emails with empty local or domain part', () => {
    expect(check('@example.com').reason).toBe('invalid-email');
    expect(check('foo@').reason).toBe('invalid-email');
  });

  it('rejects domains without a dot', () => {
    expect(check('foo@localhost').reason).toBe('invalid-email');
  });

  it('lowercases and trims the domain', () => {
    const r = check('  User@GMail.COM  ');
    expect(r.domain).toBe('gmail.com');
  });
});

describe('whitelist', () => {
  it('gmail.com is whitelisted (not a burner)', () => {
    const r = check('user@gmail.com');
    expect(r.burner).toBe(false);
    expect(r.list).toBe('whitelist');
    expect(r.reason).toBe('whitelisted');
  });

  it('whitelist overrides in both modes', () => {
    expect(isBurner('user@gmail.com', { mode: 'normal' })).toBe(false);
    expect(isBurner('user@gmail.com', { mode: 'strict' })).toBe(false);
  });
});

describe('graylist (email alias / forwarding services)', () => {
  it('duck.com is allowed in normal mode', () => {
    const r = check('user@duck.com', { mode: 'normal' });
    expect(r.burner).toBe(false);
    expect(r.list).toBe('graylist');
    expect(r.reason).toBe('graylisted-normal');
  });

  it('duck.com is blocked in strict mode', () => {
    const r = check('user@duck.com', { mode: 'strict' });
    expect(r.burner).toBe(true);
    expect(r.list).toBe('graylist');
    expect(r.reason).toBe('graylisted-strict');
  });

  it('normal mode is the default', () => {
    expect(isBurner('user@mozmail.com')).toBe(false);
    expect(isBurner('user@mozmail.com', { mode: 'strict' })).toBe(true);
  });
});

describe('unknown domains', () => {
  it('returns not-burner with reason=unknown', () => {
    const r = check('user@definitely-not-in-any-list-xyz.example');
    expect(r.burner).toBe(false);
    expect(r.list).toBeNull();
    expect(r.reason).toBe('unknown');
  });
});

describe('runtime overrides', () => {
  beforeEach(() => {
    removeFromBlacklist('runtime-block.example');
    removeFromWhitelist('runtime-allow.example');
    removeFromBlacklist('gmail.com');
    removeFromWhitelist('simplelogin.com');
  });

  it('addToBlacklist blocks an unknown domain', () => {
    expect(isBurner('user@runtime-block.example')).toBe(false);
    addToBlacklist('runtime-block.example');
    const r = check('user@runtime-block.example');
    expect(r.burner).toBe(true);
    expect(r.list).toBe('blacklist');
  });

  it('addToWhitelist rescues a graylisted domain in strict mode', () => {
    expect(isBurner('user@simplelogin.com', { mode: 'strict' })).toBe(true);
    addToWhitelist('simplelogin.com');
    expect(isBurner('user@simplelogin.com', { mode: 'strict' })).toBe(false);
    removeFromWhitelist('simplelogin.com');
    expect(isBurner('user@simplelogin.com', { mode: 'strict' })).toBe(true);
  });

  it('whitelist wins over blacklist (including runtime)', () => {
    addToBlacklist('contested.example');
    addToWhitelist('contested.example');
    expect(isBurner('user@contested.example')).toBe(false);
    removeFromBlacklist('contested.example');
    removeFromWhitelist('contested.example');
  });

  it('normalizes casing and whitespace', () => {
    addToBlacklist('  BadGuy.EXAMPLE  ');
    expect(isBurner('user@badguy.example')).toBe(true);
    removeFromBlacklist('badguy.example');
  });
});

describe('getListSizes', () => {
  it('reports non-negative sizes for all three lists', () => {
    const sizes = getListSizes();
    expect(sizes.blacklist).toBeGreaterThanOrEqual(0);
    expect(sizes.whitelist).toBeGreaterThan(0);
    expect(sizes.graylist).toBeGreaterThan(0);
  });
});
