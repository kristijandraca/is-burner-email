// Email alias / forwarding services. Blocked only in strict mode.
// These let users generate unlimited revocable aliases, so they're
// functionally disposable without being scam-tier.
export const GRAYLIST: readonly string[] = [
  // SimpleLogin (Proton)
  'simplelogin.com',
  'silomails.com',
  'slmails.com',
  'simplelogin.fr',
  'aleeas.com',
  'slmail.me',
  '8shield.net',
  'dralias.com',
  'passinbox.com',
  'passfwd.com',
  'passmail.com',
  'passmail.net',
  'simplelogin.co',
  'simplelogin.io',

  // DuckDuckGo Email Protection
  'duck.com',

  // Firefox Relay (Mozilla)
  'mozmail.com',
];
