import { createMailer } from '../mail/sender.js';
import { wireSubscribers } from '../subscribers/index.js';
import { loadConfig } from './config.js';

// Hot reload: ops edit config.json on the server and the watcher pushes the
// new content here, so we never restart during opening hours.

export function reloadConfig(app, raw) {
  const next = loadConfig(raw);
  app.config = next;
  app.mailer = createMailer({ transport: app.transport, smtp: next.smtp, log: app.log });
  wireSubscribers(app);
  app.log(`config reloaded (version ${next.version})`);
  return next;
}

/** source: anything with on('change', (raw) => ...), e.g. the file watcher. */
export function watchConfig(app, source) {
  source.on('change', (raw) => {
    try {
      reloadConfig(app, raw);
    } catch (err) {
      app.log(`config reload rejected: ${err.message}`);
    }
  });
}
