import Payment from '../models/Payment.model';
import Tenant from '../models/Tenant.model';
import Plan from '../models/Plan.model';

// ─────────────────────────────────────────────────────────────────────────────
// Cielo Service — stub
//
// Todas as funções retornam null/false até que as credenciais sejam configuradas.
// Quando disponíveis, preencher CIELO_MERCHANT_ID e CIELO_MERCHANT_KEY no .env
// e substituir os stubs pelas chamadas reais da Cielo API 3.0.
//
// Docs: https://developercielo.github.io/manual/cielo-ecommerce
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT_ID  = process.env.CIELO_MERCHANT_ID;
const MERCHANT_KEY = process.env.CIELO_MERCHANT_KEY;
const SANDBOX      = process.env.CIELO_SANDBOX !== 'false';

const BASE_URL = SANDBOX
  ? 'https://apisandbox.cieloecommerce.cielo.com.br'
  : 'https://api.cieloecommerce.cielo.com.br';

const isConfigured = (): boolean => !!(MERCHANT_ID && MERCHANT_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// createPaymentLink
// Gera um link de pagamento avulso (Cielo Checkout / Link de Pagamento).
// Retorna a URL ou null se a Cielo não estiver configurada.
// ─────────────────────────────────────────────────────────────────────────────
export const createPaymentLink = async (payment: Payment): Promise<string | null> => {
  if (!isConfigured()) {
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
  if (!isConfigured()) {
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
  if (!isConfigured()) return false;

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
