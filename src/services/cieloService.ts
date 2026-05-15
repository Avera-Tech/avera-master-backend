import Payment from '../models/Payment.model';
import Tenant from '../models/Tenant.model';
import Plan from '../models/Plan.model';
import { getSetting } from '../controllers/settingsController';

// ─────────────────────────────────────────────────────────────────────────────
// Cielo Service — stub
// Credenciais lidas do banco (tabela settings) com fallback para .env
// Docs: https://developercielo.github.io/manual/cielo-ecommerce
// ─────────────────────────────────────────────────────────────────────────────

const getCieloConfig = async () => {
  const merchantId  = (await getSetting('cielo_merchant_id'))  ?? process.env.CIELO_MERCHANT_ID  ?? null;
  const merchantKey = (await getSetting('cielo_merchant_key')) ?? process.env.CIELO_MERCHANT_KEY ?? null;
  const sandbox     = (await getSetting('cielo_sandbox')) === 'false' ? false : true;
  const baseUrl     = sandbox
    ? 'https://apisandbox.cieloecommerce.cielo.com.br'
    : 'https://api.cieloecommerce.cielo.com.br';
  return { merchantId, merchantKey, sandbox, baseUrl };
};

const isConfigured = async (): Promise<boolean> => {
  const { merchantId, merchantKey } = await getCieloConfig();
  return !!(merchantId && merchantKey);
};

// ─────────────────────────────────────────────────────────────────────────────
// createPaymentLink
// Gera um link de pagamento avulso (Cielo Checkout / Link de Pagamento).
// Retorna a URL ou null se a Cielo não estiver configurada.
// ─────────────────────────────────────────────────────────────────────────────
export const createPaymentLink = async (payment: Payment): Promise<string | null> => {
  if (!(await isConfigured())) {
    console.warn('[cielo] CIELO_MERCHANT_ID/KEY não configurados — link de pagamento indisponível');
    return null;
  }

  // TODO: implementar quando credenciais estiverem disponíveis
  // POST ${BASE_URL}/v1/paymentlinks
  // {
  //   Type: 'DigitalContent',
  //   Name: payment.description,
  //   Description: payment.description,
  //   Price: Math.round(payment.amount * 100), // centavos
  //   ExpirationDate: formatDate(payment.due_date),
  //   Payment: { Type: 'All' },
  // }

  console.log(`[cielo] stub createPaymentLink — payment #${payment.id}`);
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// createRecurrentSubscription
// Cria uma assinatura recorrente mensal para um tenant (plano Avera).
// Retorna o RecurrentPaymentId da Cielo ou null.
// ─────────────────────────────────────────────────────────────────────────────
export const createRecurrentSubscription = async (
  _tenant: Tenant,
  _plan:   Plan,
  _cardToken: string,
): Promise<string | null> => {
  if (!(await isConfigured())) {
    console.warn('[cielo] Credenciais não configuradas — recorrência indisponível');
    return null;
  }

  // TODO: implementar quando credenciais estiverem disponíveis
  // POST ${BASE_URL}/1/sales/
  // Payment.RecurrentPayment = { Interval: 'Monthly', EndDate: '...' }

  console.log('[cielo] stub createRecurrentSubscription');
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// cancelSubscription
// Cancela uma assinatura recorrente ativa na Cielo.
// ─────────────────────────────────────────────────────────────────────────────
export const cancelSubscription = async (recurrentPaymentId: string): Promise<boolean> => {
  if (!(await isConfigured())) return false;

  // TODO: PUT ${BASE_URL}/1/RecurrentPayment/${recurrentPaymentId}/Deactivate

  console.log(`[cielo] stub cancelSubscription — ${recurrentPaymentId}`);
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// handleWebhook
// Processa notificações de pagamento enviadas pela Cielo (POST callback).
// ─────────────────────────────────────────────────────────────────────────────
export const handleWebhook = async (body: unknown): Promise<void> => {
  // TODO: validar assinatura, extrair PaymentId, atualizar Payment.status

  console.log('[cielo] stub handleWebhook', body);
};
