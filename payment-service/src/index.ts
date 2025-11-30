import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import paymentRoutes from './routes/paymentRoutes.js';
import { startConsumer } from './kafka/consumer.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use('/payments', paymentRoutes);

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

app.listen(PORT, HOST, () => {
	console.log(`Payment Service rodando na porta ${PORT}`);
});

// Iniciar o consumidor Kafka
startConsumer();
