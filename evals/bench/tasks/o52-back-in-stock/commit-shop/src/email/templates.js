/** Templates the email service knows (the copy lives in the email service; this is just the subject line). */
export const TEMPLATES = {
  'order-confirmation': { subject: (data) => `Your order ${data.orderId}` },
  'password-reset': { subject: () => 'Reset your password' },
  'back-in-stock': { subject: (data) => `${data.title} is back in stock` },
};
