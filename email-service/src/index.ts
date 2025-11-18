import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import emailRoutes from './routes/emailRoutes.js';
import { startPaymentNotificationConsumer } from './messaging/rabbitmq-consumer.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use('/emails', emailRoutes);

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

app.listen(PORT, HOST, () => {
	console.log(`Email Service rodando na porta ${PORT}`);
});

startPaymentNotificationConsumer();
