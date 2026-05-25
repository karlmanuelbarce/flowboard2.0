import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
});

redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
