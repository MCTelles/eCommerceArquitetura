import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import axios from 'axios';
import { redisClient } from '../redisClient.js';
import { getCache, setCache } from '../utils/cache.js';

const prisma = new PrismaClient();
const PAYMENT_TYPES_CACHE_KEY = 'payment:types';

const ORDER_SERVICE_URL =
	process.env.ORDER_API_URL ?? 'http://order-service:3000';
const EMAIL_SERVICE_URL =
	process.env.EMAIL_SERVICE_URL ?? 'http://email-service:3000';
const USERS_SERVICE_URL =
	process.env.USERS_SERVICE_URL ?? 'http://users-service:3000';

const METODOS_PERMITIDOS = ['PIX', 'Boleto', 'Cartão'] as const;
type MetodoPagamento = (typeof METODOS_PERMITIDOS)[number];

interface PaymentInput {
	method: MetodoPagamento;
	amount: number;
}

export const listarMetodosPagamento = async (_req: Request, res: Response) => {
	try {
		const cacheKey = PAYMENT_TYPES_CACHE_KEY;

		const cached = await getCache(cacheKey);
		if (cached) {
			return res.status(200).json(cached);
		}

		const types = METODOS_PERMITIDOS;

		await setCache(cacheKey, types); // Sem TTL => infinito

		res.status(200).json(types);
	} catch (error: any) {
		console.error('Erro ao listar métodos de pagamento:', error.message);
		res.status(500).json({ message: 'Erro ao listar métodos de pagamento' });
	}
};

export const confirmarPagamento = async (req: Request, res: Response) => {
	try {
		const {
			orderId,
			payments,
		}: { orderId?: string; payments?: PaymentInput[] } = req.body ?? {};

		if (!orderId || !Array.isArray(payments) || payments.length === 0) {
			return res
				.status(400)
				.json({ message: 'orderId e payments são obrigatórios.' });
		}

		for (const payment of payments) {
			if (!METODOS_PERMITIDOS.includes(payment.method)) {
				return res
					.status(400)
					.json({ message: `Método de pagamento inválido: ${payment.method}` });
			}
		}

		const orderResponse = await axios.get(
			`${ORDER_SERVICE_URL}/orders/${orderId}`
		);
		const order = orderResponse.data;

		if (!order) {
			return res.status(404).json({ message: 'Pedido não encontrado.' });
		}

		const currentStatus = String(order.status ?? '').toUpperCase();
		if (currentStatus === 'PAID') {
			return res.status(400).json({ message: 'O pedido já foi pago.' });
		}
		if (currentStatus === 'CANCELLED') {
			return res
				.status(400)
				.json({ message: 'Pedidos cancelados não podem receber pagamento.' });
		}

		const orderTotal = Number(order.total ?? 0);
		if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
			return res
				.status(500)
				.json({ message: 'Valor total do pedido inválido.' });
		}

		const amount = payments.reduce(
			(total, payment) => total + payment.amount,
			0
		);
		if (Math.abs(amount - orderTotal) > 0.01) {
			return res.status(400).json({
				message: 'Valor informado diferente do total do pedido.',
				esperado: orderTotal,
				informado: amount,
			});
		}

		let customerEmail: string | null = null;

		try {
			const userResponse = await axios.get(
				`${USERS_SERVICE_URL}/users/${order.userId}`
			);
			customerEmail = userResponse.data?.email ?? null;
		} catch (err: any) {
			console.warn(
				'Não foi possível recuperar email do usuário:',
				err?.message ?? err
			);
		}

		const creationPromises = payments.map(payment =>
			prisma.payment.create({
				data: {
					orderId: String(orderId),
					method: payment.method,
					amount: payment.amount,
					status: 'PENDING',
				},
			})
		);

		const registros = await Promise.all(creationPromises);

		await axios.patch(`${ORDER_SERVICE_URL}/orders/${orderId}/status`, {
			status: 'PAID',
		});

		if (customerEmail) {
			const payload = {
				to: customerEmail,
				orderId,
				amount,
				payments,
			};

			const url = `${EMAIL_SERVICE_URL}/emails/payment/confirmation`;

			axios
				.post(url, payload)
				.catch((err: any) =>
					console.warn(
						'Falha ao notificar serviço de email:',
						err?.message ?? err
					)
				);
		}

		res.status(200).json({
			message: 'Pagamento confirmado.',
			payments: registros,
		});
	} catch (error: any) {
		console.error('Erro ao confirmar pagamento:', error?.message ?? error);

		if (axios.isAxiosError(error) && error.response) {
			return res.status(error.response.status).json(error.response.data);
		}

		res.status(500).json({
			message: 'Erro ao confirmar pagamento',
			error: error?.message ?? String(error),
		});
	}
};

export const buscarPagamentosDoPedido = async (req: Request, res: Response) => {
	try {
		const { orderId } = req.params;

		if (!orderId) {
			return res.status(400).json({ message: 'orderId é obrigatório.' });
		}

		const payments = await prisma.payment.findMany({
			where: { orderId: String(req.params.orderId) },
			orderBy: { createdAt: 'desc' },
		});

		res.status(200).json(payments);
	} catch (error: any) {
		console.error('Erro ao buscar pagamentos:', error?.message ?? error);
		res.status(500).json({
			message: 'Erro ao buscar pagamentos',
			error: error?.message ?? String(error),
		});
	}
};
