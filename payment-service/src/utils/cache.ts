import { redisClient } from '../redisClient.js';

/**
 * Recupera um valor do Redis
 * @param key string
 * @returns dado parseado ou null
 */
export async function getCache(key: string) {
	try {
		const data = await redisClient.get(key);
		if (!data) return null;

		return JSON.parse(data);
	} catch (error) {
		console.error('Erro ao acessar cache (getCache):', error);
		return null; // nunca quebrar a aplicação por causa do Redis
	}
}

/**
 * Salva um valor no Redis
 * @param key string
 * @param value qualquer dado serializável
 * @param ttl opcional — em segundos (EX)
 */
export async function setCache(key: string, value: any, ttl?: number) {
	try {
		const serialized = JSON.stringify(value);

		if (ttl) {
			// TTL definido
			await redisClient.set(key, serialized, { EX: ttl });
		} else {
			// TTL infinito
			await redisClient.set(key, serialized);
		}
	} catch (error) {
		console.error('Erro ao salvar no cache (setCache):', error);
	}
}
