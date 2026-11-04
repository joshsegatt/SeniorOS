import { verifySignature } from './signature.js';

/**
 * Handles one Paylane event after the server parsed its JSON body.
 * @param {{ headers: Record<string, string | undefined>, body: any }} req
 * @param {{ secret: string, onEvent: (event: any) => void, nowSec?: number }} opts
 * @returns {{ status: number, body: string }}
 */
export function handleWebhook(req, opts) {
  const payload = JSON.stringify(req.body);
  if (!verifySignature(payload, req.headers['paylane-signature'], opts.secret, opts.nowSec)) {
    return { status: 401, body: 'invalid signature' };
  }
  opts.onEvent(req.body);
  return { status: 200, body: 'ok' };
}
