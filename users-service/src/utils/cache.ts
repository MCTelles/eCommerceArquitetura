import { redisClient, connectRedis } from '../redisClient.js';

await connectRedis(); // garante a conexão antes de usar o cache

redisClient.on('connect', () => {
	console.log(
		'Conectado ao Redis:',
		process.env.REDIS_URL || 'redis://redis:6379'
	);
});

redisClient.on('error', err => {
	console.error('Redis error', err);
});

export async function getCache(key: string) {
	const data = await redisClient.get(key);

	if (data) console.log(`CACHE HIT: ${key}`);
	else console.log(`CACHE MISS: ${key}`);

	return data ? JSON.parse(data) : null;
}

export async function setCache(key: string, value: any, ttlSeconds: number) {
	console.log(`CACHE SAVE: ${key} (TTL: ${ttlSeconds}s)`);
	await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
}
