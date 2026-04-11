import Feature from '../models/Feature.model';
import { TenantPlan } from '../models/Tenant.model';
import { Transaction } from 'sequelize';

// ─────────────────────────────────────────────────────────────────────────────
// All available features in the platform
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_FEATURES = [
  'online_booking',
  'student_management',
  'basic_billing',
  'auto_reminders',
  'financial_reports',
  'wellhub_integration',
  'multi_units',
  'dedicated_api',
] as const;

export type FeatureName = typeof ALL_FEATURES[number];

// ─────────────────────────────────────────────────────────────────────────────
// Features enabled per plan
// ─────────────────────────────────────────────────────────────────────────────
export const FEATURES_BY_PLAN: Record<TenantPlan, FeatureName[]> = {
  starter: [
    'online_booking',
    'student_management',
    'basic_billing',
  ],
  professional: [
    'online_booking',
    'student_management',
    'basic_billing',
    'auto_reminders',
    'financial_reports',
    'wellhub_integration',
  ],
  enterprise: [
    'online_booking',
    'student_management',
    'basic_billing',
    'auto_reminders',
    'financial_reports',
    'wellhub_integration',
    'multi_units',
    'dedicated_api',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// provisionFeatures
//
// Creates or updates all feature flags for a tenant based on their plan.
// Uses upsert so it is safe to call multiple times (signup + plan changes).
//
// Called on:
//   - signup        → initial provisioning
//   - plan change   → re-syncs enabled/disabled state
// ─────────────────────────────────────────────────────────────────────────────
export const provisionFeatures = async (
  tenantId: number,
  plan: TenantPlan,
  transaction?: Transaction
): Promise<void> => {
  const enabledFeatures = FEATURES_BY_PLAN[plan] ?? FEATURES_BY_PLAN['starter'];

  for (const featureName of ALL_FEATURES) {
    await Feature.upsert(
      {
        tenant_id:    tenantId,
        feature_name: featureName,
        enabled:      enabledFeatures.includes(featureName as FeatureName),
      },
      {
        conflictFields: ['tenant_id', 'feature_name'],
        ...(transaction ? { transaction } : {}),
      }
    );
  }
};