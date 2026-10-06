import { Redis } from '@upstash/redis';

let redisClient = null;

/**
 * Initializes and returns the Redis client if configured.
 * @returns {Redis|null}
 */
function getRedisClient() {
  if (process.env.REDIS_ENABLED === 'false') {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    console.warn('[Redis] Failed to initialize Redis client:', err.message);
    return null;
  }
}

/**
 * Gets cached loan view if available. Fails open (returns null on error).
 *
 * @param {string} loanId
 * @param {string} asOf
 * @returns {Promise<Object|null>}
 */
export async function getCachedLoanView(loanId, asOf) {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const ver = (await redis.get(`loan:${loanId}:ver`)) || 0;
    const cacheKey = `loan:${loanId}:v${ver}:asOf:${asOf}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
    }
    return null;
  } catch (err) {
    console.warn('[Redis Cache GET Error]:', err.message);
    return null; // fail-open
  }
}

/**
 * Sets cached loan view with 60-second TTL. Fails open.
 *
 * @param {string} loanId
 * @param {string} asOf
 * @param {Object} data
 */
export async function setCachedLoanView(loanId, asOf, data) {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const ver = (await redis.get(`loan:${loanId}:ver`)) || 0;
    const cacheKey = `loan:${loanId}:v${ver}:asOf:${asOf}`;
    await redis.set(cacheKey, JSON.stringify(data), { ex: 60 });
  } catch (err) {
    console.warn('[Redis Cache SET Error]:', err.message);
  }
}

/**
 * Increments loan version counter, invalidating all previous cached views for this loan.
 *
 * @param {string} loanId
 */
export async function invalidateLoanCache(loanId) {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.incr(`loan:${loanId}:ver`);
  } catch (err) {
    console.warn('[Redis Cache INCR Error]:', err.message);
  }
}
