import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ordersRoutes from './routes/orderRoutes.js';
import { connectProducer } from './kafka/producer.js';
import { connectRedis } from './redisClient.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use('/orders', ordersRoutes);

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

async function bootstrap() {
	await connectRedis();
	app.listen(PORT, () => {
		console.log(`products-service rodando na porta ${PORT}`);
	});
}

bootstrap();
connectProducer();
