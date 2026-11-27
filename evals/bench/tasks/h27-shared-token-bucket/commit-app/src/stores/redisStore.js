// Redis-backed store used in production. Same interface as MemoryStore.
// `client` is a node-redis v4 client (injected by src/index.js in production).

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if (current == false and ARGV[1] == '') or current == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
  return 1
end
return 0
`;

const NULL_SENTINEL = '';
const TTL_MS = 24 * 60 * 60 * 1000;

export class RedisStore {
  constructor(client) {
    this.client = client;
  }

  async get(key) {
    return this.client.get(key);
  }

  async set(key, value) {
    await this.client.set(key, value, { PX: TTL_MS });
  }

  async compareAndSet(key, expected, next) {
    const result = await this.client.eval(CAS_SCRIPT, {
      keys: [key],
      arguments: [expected === null ? NULL_SENTINEL : expected, next, String(TTL_MS)],
    });
    return result === 1;
  }

  async delete(key) {
    await this.client.del(key);
  }
}
