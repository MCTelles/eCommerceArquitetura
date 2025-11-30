// src/utils/cache.ts
import { createClient } from 'redis';

const redis = createClient({
	url: process.env.REDIS_URL || 'redis://redis:6379',
});

redis.on('connect', () => {
	console.log(
		'Conectado ao Redis:',
		process.env.REDIS_URL || 'redis://redis:6379'
	);
});

redis.on('error', err => {
	console.error('Redis error', err);
});

await redis.connect();

export async function getCache(key: string) {
	const data = await redis.get(key);

	if (data) {
		console.log(`CACHE HIT: ${key}`);
	} else {
		console.log(`CACHE MISS: ${key}`);
	}

	return data ? JSON.parse(data) : null;
}

export async function setCache(key: string, value: any, ttlSeconds: number) {
	console.log(`CACHE SAVE: ${key} (TTL: ${ttlSeconds}s)`);
	await redis.setEx(key, ttlSeconds, JSON.stringify(value));
}
