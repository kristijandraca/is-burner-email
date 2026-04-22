// Manually-curated burner / disposable domains to include in the blacklist,
// for cases where upstream sources haven't picked up a domain yet, are slow
// to update, or have rejected a submission.
//
// These are merged with the upstream aggregated list during
// `npm run build:lists`. Whitelist still overrides — if you accidentally
// add a legitimate domain here, the whitelist will neutralize it.
//
// Keep entries sorted alphabetically within each group. Include a short
// comment above each entry or group explaining why it's blacklisted.
export const EXTRA_BLACKLIST: readonly string[] = [
  // Add domains here, e.g.:
  // 'example-burner-service.com',
];
