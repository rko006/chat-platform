import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export async function connectRedis(): Promise<void> {
  try {
    const redisConfig = process.env.REDIS_URL
      ? { url: process.env.REDIS_URL }
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          retryStrategy: (times: number) => {
            if (times > 10) {
              logger.warn('Redis: Max retry attempts reached. Running without cache.');
              return null;
            }
            return Math.min(times * 200, 2000);
          },
        };

    redisClient = new Redis(redisConfig as any);

    redisClient.on('connect', () => logger.info('✅ Redis connected'));
    redisClient.on('error', (err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    logger.error('Redis error:', err);
  }
});
    redisClient.on('close', () => logger.warn('Redis connection closed'));

  } catch (error) {
    logger.warn('Redis connection failed. Continuing without cache:', error);
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

// ─── Cache Helpers ──────────────────────────────────────────────────────────
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.warn('Redis set error:', err);
    }
  },

  async del(key: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.del(key);
    } catch (err) {
      logger.warn('Redis del error:', err);
    }
  },

  async delPattern(pattern: string): Promise<void> {
    if (!redisClient) return;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {
      logger.warn('Redis delPattern error:', err);
    }
  },

  async hset(key: string, field: string, value: any): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.hset(key, field, JSON.stringify(value));
    } catch (err) {
      logger.warn('Redis hset error:', err);
    }
  },

  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!redisClient) return null;
    try {
      const data = await redisClient.hget(key, field);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async hdel(key: string, field: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.hdel(key, field);
    } catch {}
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.expire(key, seconds);
    } catch {}
  },
};

// ─── Online Status Management ───────────────────────────────────────────────
export const onlineStatus = {
  async setOnline(userId: string, socketId: string): Promise<void> {
    await cache.hset('online_users', userId, { socketId, lastSeen: new Date() });
    await cache.expire('online_users', 86400); // 24h
  },

  async setOffline(userId: string): Promise<void> {
    await cache.hdel('online_users', userId);
  },

  async isOnline(userId: string): Promise<boolean> {
    const data = await cache.hget('online_users', userId);
    return data !== null;
  },

  async getOnlineUsers(): Promise<string[]> {
    if (!redisClient) return [];
    try {
      const data = await redisClient.hkeys('online_users');
      return data;
    } catch {
      return [];
    }
  },
};
