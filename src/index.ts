import blacklistData from '../data/blacklist.json';
import { GRAYLIST } from '../data/graylist.js';
import { WHITELIST } from '../data/whitelist.js';

export type Mode = 'normal' | 'strict';
export type ListName = 'blacklist' | 'whitelist' | 'graylist';

export interface CheckOptions {
  mode?: Mode;
}

export interface CheckResult {
  burner: boolean;
  domain: string | null;
  list: ListName | null;
  reason:
    | 'invalid-email'
    | 'whitelisted'
    | 'blacklisted'
    | 'graylisted-strict'
    | 'graylisted-normal'
    | 'unknown';
}

const blacklist: Set<string> = new Set(blacklistData as string[]);
const whitelist: Set<string> = new Set(WHITELIST);
const graylist: Set<string> = new Set(GRAYLIST);

const runtimeBlacklist = new Set<string>();
const runtimeWhitelist = new Set<string>();

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function extractDomain(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain.includes('.')) return null;
  return domain;
}

export function check(email: string, options: CheckOptions = {}): CheckResult {
  const mode: Mode = options.mode ?? 'normal';
  const domain = extractDomain(email);

  if (!domain) {
    return { burner: false, domain: null, list: null, reason: 'invalid-email' };
  }

  if (runtimeWhitelist.has(domain) || whitelist.has(domain)) {
    return { burner: false, domain, list: 'whitelist', reason: 'whitelisted' };
  }

  if (runtimeBlacklist.has(domain) || blacklist.has(domain)) {
    return { burner: true, domain, list: 'blacklist', reason: 'blacklisted' };
  }

  if (graylist.has(domain)) {
    if (mode === 'strict') {
      return { burner: true, domain, list: 'graylist', reason: 'graylisted-strict' };
    }
    return { burner: false, domain, list: 'graylist', reason: 'graylisted-normal' };
  }

  return { burner: false, domain, list: null, reason: 'unknown' };
}

export function isBurner(email: string, options: CheckOptions = {}): boolean {
  return check(email, options).burner;
}

export function addToBlacklist(domain: string): void {
  runtimeBlacklist.add(normalize(domain));
}

export function addToWhitelist(domain: string): void {
  runtimeWhitelist.add(normalize(domain));
}

export function removeFromBlacklist(domain: string): boolean {
  return runtimeBlacklist.delete(normalize(domain));
}

export function removeFromWhitelist(domain: string): boolean {
  return runtimeWhitelist.delete(normalize(domain));
}

export function getListSizes(): { blacklist: number; whitelist: number; graylist: number } {
  return {
    blacklist: blacklist.size,
    whitelist: whitelist.size,
    graylist: graylist.size,
  };
}
