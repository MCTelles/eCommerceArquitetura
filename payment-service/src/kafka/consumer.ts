import { Kafka } from 'kafkajs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const kafka = new Kafka({
	clientId: 'payment-service',
	brokers: ['kafka:9092'],
});

export const consumer = kafka.consumer({ groupId: 'payment-service-group' });

export async function startConsumer() {
	await consumer.connect();
	console.log('Kafka Consumer conectado (payment-service)');

	await consumer.subscribe({
		topic: 'order.created',
		fromBeginning: false,
	});
	await consumer.run({
		eachMessage: async ({ message }) => {
			try {
				const eventData = JSON.parse(message.value?.toString() || '{}');

				const { order, payment } = eventData;

				if (!order || !payment) {
					console.error('Evento inválido recebido:', eventData);
					return;
				}

				console.log('📥 Evento recebido:', eventData);

				const createdPayment = await prisma.payment.create({
					data: {
						orderId: order.id,
						amount: payment.amount,
						method: payment.method,
						status: 'PENDING',
					},
				});

				console.log('💾 Pagamento salvo:', createdPayment);
			} catch (err: any) {
				console.error('Erro ao processar evento Kafka:', err.message);
			}
		},
	});
}
