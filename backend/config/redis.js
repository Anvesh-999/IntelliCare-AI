// Native in-memory cache fallback (No external Redis server required)
const memoryStore = new Map();

const memoryCache = {
  get: async (key) => memoryStore.get(key) || null,
  set: async (key, value, options) => {
    memoryStore.set(key, value);
    if (options && options.EX) {
      setTimeout(() => {
        memoryStore.delete(key);
      }, options.EX * 1000);
    }
    return 'OK';
  },
  del: async (key) => {
    return memoryStore.delete(key) ? 1 : 0;
  },
  quit: async () => {},
  connect: async () => {}
};

const connectRedis = async () => {
  console.log('[Cache] Using native in-memory cache (Redis disabled)');
};

const getClient = () => memoryCache;

module.exports = {
  connectRedis,
  getClient,
  isRedisConnected: () => false
};
