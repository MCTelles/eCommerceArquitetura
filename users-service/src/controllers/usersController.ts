import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { redisClient } from '../redisClient.js';
import { getCache, setCache } from '../utils/cache.js';

const ONE_DAY_SECONDS = 60 * 60 * 24;

const prisma = new PrismaClient();

// Criar novo usuário
export const criarUsuario = async (req: Request, res: Response) => {
	try {
		const { name, email } = req.body;

		if (!name || !email) {
			return res.status(400).json({ message: 'Nome e email são obrigatórios' });
		}

		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return res.status(400).json({ message: 'Email já está em uso' });
		}

		const newUser = await prisma.user.create({ data: { name, email } });
		res.status(201).json(newUser);
	} catch (error: any) {
		console.error('Erro ao criar usuário:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};

// Listar todos os usuários
export const listarUsuarios = async (_req: Request, res: Response) => {
	try {
		const users = await prisma.user.findMany({
			select: { id: true, name: true, email: true, createdAt: true },
		});
		res.status(200).json(users);
	} catch (error: any) {
		console.error('Erro ao listar usuários:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};

// Buscar usuário por ID
export const buscarUsuarioPorId = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const cacheKey = `user:${id}`;

		// 1) tenta pegar do cache
		const cached = await getCache(cacheKey);
		if (cached) {
			return res.status(200).json(cached);
		}

		// 2) se não tiver no cache, busca no banco
		const user = await prisma.user.findUnique({ where: { id: Number(id) } });

		if (!user) {
			return res.status(404).json({ message: 'Usuário não encontrado.' });
		}

		// 3) salvar no cache com TTL de 1 dia
		await setCache(cacheKey, user, ONE_DAY_SECONDS);

		return res.status(200).json(user);
	} catch (error: any) {
		console.error('Erro ao buscar usuário:', error?.message ?? error);
		return res.status(500).json({
			message: 'Erro ao buscar usuário',
			error: error?.message ?? String(error),
		});
	}
};
