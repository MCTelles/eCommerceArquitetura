import { Kafka } from 'kafkajs';

export const kafka = new Kafka({
	clientId: 'order-service',
	brokers: ['kafka:9092'],
});

export const producer = kafka.producer();

export async function connectProducer() {
	await producer.connect();
	console.log('Producer Kafka conectado');
}
