import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN, isRedirect, newBrowser } from './browser.js';

// Bonus (not required to pass): browsers strip tabs and newlines from URLs, so these become //evil.example.
for (const value of ['/\t/evil.example/', '/\n/evil.example/', ' //evil.example/']) {
  test(`whitespace tricks do not redirect off-site: ${JSON.stringify(value)}`, async () => {
    const probe = newBrowser();
    const guard = await probe.send('GET', '/orders/42');
    const url = probe.target(guard);
    const param = [...url.searchParams].find(([, v]) => v.includes('/orders/42'))?.[0] ?? 'next';
    const b = newBrowser();
    const page = await b.open(`${url.pathname}?${new URLSearchParams({ [param]: value })}`);
    assert.ok(!page.offsite);
    const res = await b.submitLogin(page);
    if (res.noForm || !isRedirect(res)) return;
    assert.equal(b.target(res).origin, ORIGIN);
  });
}
