import amqp from 'amqplib';

const RABBITMQ_URL =
	process.env.RABBITMQ_URL ?? 'amqp://ecommerce:ecommerce@rabbitmq:5672';

const QUEUE_NAME =
	process.env.PAYMENT_NOTIFICATION_QUEUE ?? 'payment_notifications';

let channelPromise: Promise<amqp.Channel> | null = null;

async function getChannel(): Promise<amqp.Channel> {
	if (!channelPromise) {
		channelPromise = (async () => {
			const connection = await amqp.connect(RABBITMQ_URL);
			const channel = await connection.createChannel();

			await channel.assertQueue(QUEUE_NAME, { durable: true });

			process.on('exit', () => {
				channel.close().catch(() => {});
				connection.close().catch(() => {});
			});

			return channel;
		})();
	}

	return channelPromise;
}

export interface PaymentConfirmedEvent {
	orderId: string;
	userId: number;
	userName: string;
}

export async function publishPaymentConfirmed(
	event: PaymentConfirmedEvent
): Promise<void> {
	try {
		const channel = await getChannel();
		const messageBuffer = Buffer.from(JSON.stringify(event));

		channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true });
	} catch (error: any) {
		console.warn(
			'Falha ao publicar evento de pagamento confirmado:',
			error?.message ?? error
		);
	}
}
