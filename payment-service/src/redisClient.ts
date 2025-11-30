import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';

export const redisClient = createClient({
	url: redisUrl,
});

redisClient.on('error', err => {
	console.error('Erro no Redis:', err);
});

export async function connectRedis() {
	if (!redisClient.isOpen) {
		await redisClient.connect();
		console.log('Conectado ao Redis:', redisUrl);
	}
}
