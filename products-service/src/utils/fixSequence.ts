import { prisma } from '../prisma/prismaClient.js';

export async function fixProductSequence() {
	try {
		const maxIdResult = await prisma.product.findMany({
			select: { id: true },
			orderBy: { id: 'desc' },
			take: 1,
		});

		const maxId = maxIdResult.length > 0 ? maxIdResult[0].id : 0;

		const nextId = maxId + 1;

		await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"Product"', 'id'),
        ${nextId},
        false
      );
    `);

		console.log(`🛠 Sequence ajustada automaticamente → próximo ID = ${nextId}`);
	} catch (error) {
		console.error('❌ Erro ao ajustar sequence:', error);
	}
}
