// src/services/payment-confirmation.ts
import { sendEmail } from '../utils/sendEmail.js';

export interface PaymentEmailInput {
	to: string;
	orderId: string;
	amount: number;
	payments?: Array<{ method: string; amount: number; success?: boolean }>;
}

export async function processPaymentConfirmationEmail(data: PaymentEmailInput) {
	const { to, orderId, amount, payments } = data;

	if (!to || !orderId || typeof amount !== 'number') {
		throw new Error('Campos to, orderId e amount são obrigatórios.');
	}

	const paymentsList =
		payments
			?.map(p => `• ${p.method} - R$ ${p.amount.toFixed(2)}`)
			.join('<br>') ?? '';

	const html = `
    <p>Olá,</p>
    <p>Seu pagamento do pedido <strong>${orderId}</strong> foi confirmado com sucesso.</p>
    <p>Total: <strong>R$ ${amount.toFixed(2)}</strong></p>
    ${paymentsList ? `<p>Detalhes:</p><p>${paymentsList}</p>` : ''}
    <p>Obrigado por comprar conosco!</p>
  `;

	await sendEmail(`Pagamento confirmado - Pedido ${orderId}`, html, to);
}
