import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ordersRoutes from './routes/orderRoutes.js';
import { connectProducer } from './kafka/producer.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use('/orders', ordersRoutes);

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

app.listen(PORT, HOST, () => {
	console.log(`Order Service rodando na porta ${PORT}`);
});

// Conecta o producer do Kafka ao iniciar o serviço
connectProducer();
