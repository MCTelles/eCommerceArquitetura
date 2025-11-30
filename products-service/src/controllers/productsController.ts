import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import axios from 'axios';
import { getCache, setCache } from '../utils/cache.js';

const prisma = new PrismaClient();

const EMAIL_SERVICE_URL =
	process.env.EMAIL_SERVICE_URL ?? 'http://email-service:3000';
const SUPPLIER_EMAIL =
	process.env.SUPPLIER_EMAIL ?? 'fornecedor@ecommerce.local';
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD ?? 5);

// Listar todos os produtos
export const listarProdutos = async (_req: Request, res: Response) => {
	try {
		const cacheKey = 'products:all';

		// 1) Tenta recuperar do Redis
		const cached = await getCache(cacheKey);
		if (cached) {
			return res.status(200).json(cached);
		}

		// 2) Busca no banco
		const products = await prisma.product.findMany({
			orderBy: { createdAt: 'desc' },
		});

		// 3) Salva no Redis por 4 horas
		await setCache(cacheKey, products, 4 * 60 * 60);

		res.status(200).json(products);
	} catch (error: any) {
		console.error('Erro ao listar produtos:', error?.message ?? error);
		res.status(500).json({
			message: 'Erro ao listar produtos',
			error: error?.message ?? String(error),
		});
	}
};

// Listar produto por ID
export const listarProdutoId = async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);

		if (Number.isNaN(id)) {
			return res.status(400).json({ message: 'ID inválido.' });
		}
		const product = await prisma.product.findUnique({ where: { id } });
		if (!product)
			return res.status(404).json({ message: 'Produto não encontrado.' });
		res.status(200).json(product);
	} catch (error: any) {
		console.error('Erro ao listar produto:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};

// Criar produto
export const criarProduto = async (req: Request, res: Response) => {
	try {
		const { name, price, stock } = req.body;
		if (!name || price === undefined || stock === undefined) {
			return res
				.status(400)
				.json({ message: 'Nome, preço e estoque são obrigatórios' });
		}
		if (price < 0 || stock < 0) {
			return res
				.status(400)
				.json({ message: 'Preço e estoque não podem ser negativos' });
		}
		const newProduct = await prisma.product.create({
			data: { name, price, stock },
		});
		res.status(201).json(newProduct);
	} catch (error: any) {
		console.error('Erro ao criar produto:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};

// Atualizar produto por ID
export const atualizarProdutoId = async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);

		if (Number.isNaN(id)) {
			return res.status(400).json({ message: 'ID inválido.' });
		}
		const { name, price, stock } = req.body;
		const product = await prisma.product.findUnique({ where: { id } });
		if (!product)
			return res.status(404).json({ message: 'Produto não encontrado.' });

		const updatedProduct = await prisma.product.update({
			where: { id },
			data: {
				name: name ?? product.name,
				price: price ?? product.price,
				stock: stock ?? product.stock,
			},
		});
		res.status(200).json(updatedProduct);
	} catch (error: any) {
		console.error('Erro ao atualizar produto:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};

// Deletar produto por ID
export const deletarProdutoId = async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);

		if (Number.isNaN(id)) {
			return res.status(400).json({ message: 'ID inválido.' });
		}
		const product = await prisma.product.findUnique({ where: { id } });
		if (!product)
			return res.status(404).json({ message: 'Produto não encontrado.' });
		await prisma.product.delete({ where: { id } });
		res.status(204).send();
	} catch (error: any) {
		console.error('Erro ao deletar produto:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};

// Atualizar estoque de forma incremental
export const atualizarEstoqueProduto = async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);

		if (Number.isNaN(id)) {
			return res.status(400).json({ message: 'ID inválido.' });
		}

		const { stock } = req.body;

		if (typeof stock !== 'number') {
			return res
				.status(400)
				.json({ message: "O campo 'stock' deve ser numérico." });
		}

		const product = await prisma.product.findUnique({ where: { id } });
		if (!product)
			return res.status(404).json({ message: 'Produto não encontrado.' });

		const novoEstoque = product.stock + stock;

		if (novoEstoque < 0) {
			return res.status(400).json({
				message: `Operação inválida. Estoque atual (${product.stock}) não pode ser reduzido para negativo.`,
			});
		}

		const updatedProduct = await prisma.product.update({
			where: { id },
			data: { stock: novoEstoque },
		});

		// Envia notificação se o estoque ficar abaixo do limite
		if (updatedProduct.stock <= LOW_STOCK_THRESHOLD) {
			axios
				.post(`${EMAIL_SERVICE_URL}/emails/inventory/low-stock`, {
					to: SUPPLIER_EMAIL,
					productId: updatedProduct.id,
					productName: updatedProduct.name,
					currentStock: updatedProduct.stock,
					threshold: LOW_STOCK_THRESHOLD,
				})
				.catch((error: any) =>
					console.warn(
						'Falha ao notificar estoque baixo:',
						error?.message ?? error
					)
				);
		}

		res.status(200).json({
			message: 'Estoque atualizado com sucesso.',
			produto: updatedProduct,
		});
	} catch (error: any) {
		console.error('Erro ao atualizar estoque:', error.message);
		res
			.status(500)
			.json({ message: 'Erro interno do servidor', error: error.message });
	}
};
