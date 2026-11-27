// Runtime configuration. Validated and deep-frozen; never mutated in place.

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

function req(cond, msg) {
  if (!cond) throw new TypeError(`invalid config: ${msg}`);
}

export function loadConfig(raw) {
  req(raw && typeof raw === 'object', 'expected an object');
  const { version = 'unversioned', shopName, mail, smtp, loyalty = {}, webhooks = {} } = raw;
  req(typeof shopName === 'string' && shopName, 'shopName');
  req(mail && /@/.test(mail.from ?? ''), 'mail.from');
  req(mail.replyTo == null || /@/.test(mail.replyTo), 'mail.replyTo');
  req(smtp && typeof smtp.host === 'string' && smtp.host, 'smtp.host');
  const pointsPerChf = loyalty.pointsPerChf ?? 1;
  req(Number.isInteger(pointsPerChf) && pointsPerChf >= 0, 'loyalty.pointsPerChf');
  const urls = webhooks.urls ?? [];
  req(Array.isArray(urls) && urls.every((u) => /^https:\/\//.test(u)), 'webhooks.urls must be https URLs');

  return deepFreeze({
    version: String(version),
    shopName,
    mail: { from: mail.from, replyTo: mail.replyTo ?? mail.from },
    smtp: { host: smtp.host, user: smtp.user ?? null },
    loyalty: { pointsPerChf },
    webhooks: { urls: [...urls] },
  });
}
