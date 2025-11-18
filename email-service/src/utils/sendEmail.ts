import nodemailer from 'nodemailer';

const DEFAULT_FROM = process.env.MAIL_FROM ?? 'no-reply@ecommerce.local';

export const transporter = nodemailer.createTransport({
	jsonTransport: true, // simula envio no console
});

export async function sendEmail(subject: string, html: string, to: string) {
	const info = await transporter.sendMail({
		from: DEFAULT_FROM,
		to,
		subject,
		html,
	});

	console.log(
		'Email simulado enviado',
		JSON.stringify(
			{
				to,
				subject,
				html,
				messageId: info.messageId,
			},
			null,
			2
		)
	);
}
