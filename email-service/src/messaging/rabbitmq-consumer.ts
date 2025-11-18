import amqp from 'amqplib';

const RABBITMQ_URL =
	process.env.RABBITMQ_URL ?? 'amqp://ecommerce:ecommerce@rabbitmq:5672';

const QUEUE_NAME =
	process.env.PAYMENT_NOTIFICATION_QUEUE ?? 'payment_notifications';

export async function startPaymentNotificationConsumer(): Promise<void> {
	try {
		const connection = await amqp.connect(RABBITMQ_URL);
		const channel = await connection.createChannel();

		await channel.assertQueue(QUEUE_NAME, { durable: true });

		console.log(
			`[notification-service] Aguardando mensagens em '${QUEUE_NAME}'...`
		);

		channel.consume(
			QUEUE_NAME,
			msg => {
				if (!msg) return;

				try {
					const data = JSON.parse(msg.content.toString()) as {
						orderId: string;
						userId: number;
						userName: string;
					};

					const nomeCliente = data.userName ?? 'Cliente';

					console.log('=======================================');
					console.log(
						`📦 ${nomeCliente}, seu pedido foi PAGO com sucesso e será despachado em breve!`
					);
					console.log(`➡ Pedido: #${data.orderId}`);
					console.log('=======================================');
				} catch (error: any) {
					console.error(
						'[notification-service] Erro ao processar mensagem:',
						error?.message ?? error
					);
				} finally {
					channel.ack(msg);
				}
			},
			{ noAck: false }
		);
	} catch (error: any) {
		console.error(
			'[notification-service] Erro ao conectar no RabbitMQ:',
			error?.message ?? error
		);

		// tentar novamente
		setTimeout(() => void startPaymentNotificationConsumer(), 5000);
	}
}
