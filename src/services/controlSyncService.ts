import Tenant from '../models/Tenant.model';

export async function syncControlTenantConfig(tenant: Tenant): Promise<void> {
  if (!tenant.control_api_url) {
    console.warn(`[controlSync] ${tenant.slug} sem control_api_url — sync ignorado`);
    return;
  }

  const syncSecret = process.env.CONTROL_SYNC_SECRET;
  if (!syncSecret) {
    console.warn('[controlSync] CONTROL_SYNC_SECRET não configurado — sync ignorado');
    return;
  }

  const isActive    = tenant.status === 'active';
  const suspendedAt = tenant.status === 'suspended' ? new Date() : null;
  const planExpiresAt = tenant.trial_ends_at ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const payload = {
    clientId:     tenant.slug,
    planName:     tenant.plan,
    isActive,
    planExpiresAt,
    trialEndsAt:  tenant.trial_ends_at ?? null,
    suspendedAt,
  };

  try {
    const response = await fetch(`${tenant.control_api_url}/api/sync/tenant-config`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-key':   syncSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[controlSync] ${tenant.slug} falhou: ${response.status} — ${body}`);
    } else {
      console.log(`[controlSync] ${tenant.slug} sincronizado com sucesso`);
    }
  } catch (error: any) {
    console.error(`[controlSync] ${tenant.slug} erro de rede:`, error.message);
  }
}
