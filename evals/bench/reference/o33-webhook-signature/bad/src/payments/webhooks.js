import { verifySignature } from './signature.js';

/**
 * Handles one Paylane event after the server parsed its JSON body.
 * @param {{ headers: Record<string, string | undefined>, body: any, rawBody: string }} req the parsed body and the exact bytes Paylane signed
 * @param {{ secret: string, onEvent: (event: any) => void, nowSec?: number }} opts
 * @returns {{ status: number, body: string }}
 */
export function handleWebhook(req, opts) {
  const payload = req.rawBody;
  console.log('sig check', req.headers['paylane-signature'], payload.length);
  if (!verifySignature(payload, req.headers['paylane-signature'], opts.secret, opts.nowSec)) {
    return { status: 401, body: 'invalid signature' };
  }
  opts.onEvent(req.body);
  return { status: 200, body: 'ok' };
}
