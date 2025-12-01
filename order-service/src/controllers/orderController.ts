import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import axios from 'axios';
import { producer as kafkaProducer } from '../kafka/producer.js';
import { getCache, setCache } from '../utils/cache.js';
import { redisClient } from '../redisClient.js';

const prisma = new PrismaClient();
const THIRTY_DAYS = 30 * 24 * 60 * 60;

const USERS_SERVICE_URL =
	process.env.USERS_SERVICE_URL ?? 'http://users-service:3000';
const PRODUCTS_SERVICE_URL =
	process.env.PRODUCTS_SERVICE_URL ?? 'http://products-service:3000';

const ORDER_STATUS = ['PENDING', 'FAILED', 'PAID', 'CANCELLED'] as const;
type OrderStatusValue = (typeof ORDER_STATUS)[number];

interface OrderItemInput {
	productId: number;
	quantity: number;
}

interface OrderItemOutput {
	productId: number;
	quantity: number;
	subtotal: number;
}

export const criarPedido = async (req: Request, res: Response) => {
	try {
		const { userId, items }: { userId: number; items: OrderItemInput[] } =
			req.body;

		if (!userId || !Array.isArray(items) || items.length === 0) {
			return res
				.status(400)
				.json({ message: 'userId e items são obrigatórios.' });
		}

		// Valida usuário no serviço de usuários
		const userResponse = await axios.get(
			`${USERS_SERVICE_URL}/users/${userId}`
		);

		if (!userResponse.data) {
			return res.status(404).json({ message: 'Usuário não encontrado.' });
		}

		let total = 0;

		const orderItems: OrderItemOutput[] = [];

		for (const item of items) {
			const productResponse = await axios.get(
				`${PRODUCTS_SERVICE_URL}/products/${item.productId}`
			);
			const product = productResponse.data;

			if (!product) {
				return res
					.status(404)
					.json({ message: `Produto ${item.productId} não encontrado.` });
			}

			if (product.stock < item.quantity) {
				return res.status(400).json({
					message: `Estoque insuficiente para o produto ${product.name}.`,
				});
			}

			const subtotal = product.price * item.quantity;
			total += subtotal;

			await axios.patch(
				`${PRODUCTS_SERVICE_URL}/products/${item.productId}/stock`,
				{
					stock: -item.quantity,
				}
			);

			orderItems.push({
				productId: item.productId,
				quantity: item.quantity,
				subtotal,
			});
		}

		const newOrder = await prisma.order.create({
			data: {
				userId,
				total,
				items: orderItems,
			},
		});

		await kafkaProducer.send({
			topic: 'order.created',
			messages: [
				{
					value: JSON.stringify({
						order: newOrder,
						payment: {
							orderId: newOrder.id,
							amount: newOrder.total,
							method: 'CREDIT_CARD', // por enquanto está com método fixo
							status: 'PENDING',
						},
					}),
				},
			],
		});

		res.status(201).json(newOrder);
	} catch (error: any) {
		console.error('Erro ao criar pedido:', error?.message ?? error);

		if (axios.isAxiosError(error) && error.response) {
			return res.status(error.response.status).json(error.response.data);
		}

		res.status(500).json({
			message: 'Erro ao criar pedido',
			error: error?.message ?? String(error),
		});
	}
};

export const listarPedidos = async (_req: Request, res: Response) => {
	try {
		const orders = await prisma.order.findMany({
			orderBy: { createdAt: 'desc' },
		});
		res.status(200).json(orders);
	} catch (error: any) {
		console.error('Erro ao listar pedidos:', error?.message ?? error);
		res.status(500).json({
			message: 'Erro ao listar pedidos',
			error: error?.message ?? String(error),
		});
	}
};

export const buscarPedidoPorId = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const cacheKey = `order:${id}`;

		if (!id) {
			return res.status(400).json({ message: 'ID inválido' });
		}

		// 1. tenta encontrar no cache
		const cached = await getCache(cacheKey);
		if (cached) {
			return res.status(200).json(cached);
		}

		// 2. busca no banco
		const order = await prisma.order.findUnique({
			where: { id },
		});

		if (!order) {
			return res.status(404).json({ message: 'Pedido não encontrado.' });
		}

		// 3. salva no cache por 30 dias
		await setCache(cacheKey, order, THIRTY_DAYS);

		return res.status(200).json(order);
	} catch (err: any) {
		console.error(err);
		res.status(500).json({ message: 'Erro interno', error: err.message });
	}
};

export const buscarPedidosDoUsuario = async (req: Request, res: Response) => {
	try {
		const userId = Number(req.params.userId);

		if (Number.isNaN(userId)) {
			return res.status(400).json({ message: 'userId inválido.' });
		}

		const orders = await prisma.order.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
		});

		res.status(200).json(orders);
	} catch (error: any) {
		console.error(
			'Erro ao buscar pedidos do usuário:',
			error?.message ?? error
		);
		res.status(500).json({
			message: 'Erro ao buscar pedidos do usuário',
			error: error?.message ?? String(error),
		});
	}
};

export const atualizarStatusPedido = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { status } = req.body as { status?: OrderStatusValue };

		if (!status || !ORDER_STATUS.includes(status)) {
			return res.status(400).json({ message: 'Status inválido.' });
		}

		const updatedOrder = await prisma.order.update({
			where: { id },
			data: { status },
		});

		// 🧹 INVALIDAR CACHE DO PEDIDO
		const cacheKey = `order:${id}`;
		await redisClient.del(cacheKey);

		res.status(200).json(updatedOrder);
	} catch (error: any) {
		console.error(
			'Erro ao atualizar status do pedido:',
			error?.message ?? error
		);

		if (error?.code === 'P2025') {
			return res.status(404).json({ message: 'Pedido não encontrado.' });
		}

		res.status(500).json({
			message: 'Erro ao atualizar status do pedido',
			error: error?.message ?? String(error),
		});
	}
};
