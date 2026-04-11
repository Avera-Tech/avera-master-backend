import { Sequelize, QueryTypes } from 'sequelize';
import Tenant from '../models/Tenant.model';
import { sendEmail } from '../core/email/emailService';

// ─────────────────────────────────────────────────────────────────────────────
// provisionTenantDatabase
//
// Tries to create the tenant's database automatically.
// If it fails (permission denied, hosting limitation, etc.):
//   - Updates tenant status to 'pending_provision'
//   - Sends an alert email to the Avera admin
//   - Does NOT break signup — tenant record is already saved
//
// Called after signup transaction is committed.
// ─────────────────────────────────────────────────────────────────────────────
export const provisionTenantDatabase = async (tenantId: number): Promise<void> => {
  const tenant = await Tenant.findByPk(tenantId);

  if (!tenant) {
    console.error(`[provision] Tenant ${tenantId} not found`);
    return;
  }

  if (!tenant.db_name) {
    console.error(`[provision] Tenant ${tenantId} has no db_name`);
    return;
  }

  const dbName = tenant.db_name;

  try {
    // ── Connect using root/admin credentials (must have CREATE privilege) ─────
    const adminConn = new Sequelize(
      'mysql',
      process.env.DB_ADMIN_USER!,
      process.env.DB_ADMIN_PASS!,
      {
        host:    process.env.DB_HOST,
        port:    Number(process.env.DB_PORT ?? 3306),
        dialect: 'mysql',
        logging: false,
      }
    );

    await adminConn.authenticate();

    // ── Create the database ───────────────────────────────────────────────────
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      { type: QueryTypes.RAW }
    );

    await adminConn.close();

    console.log(`[provision] Database "${dbName}" created for tenant ${tenantId} ✓`);

  } catch (error: any) {
    console.error(`[provision] Failed to create database "${dbName}" for tenant ${tenantId}:`, error?.message);

    // ── Mark tenant as pending manual provisioning ────────────────────────────
    await tenant.update({ status: 'pending_provision' });

    // ── Alert Avera admin by email ────────────────────────────────────────────
    await sendProvisionAlert(tenant.id, tenant.company_name, dbName, error?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// sendProvisionAlert
// Sends an alert email to the Avera admin when auto-provisioning fails
// ─────────────────────────────────────────────────────────────────────────────
const sendProvisionAlert = async (
  tenantId: number,
  companyName: string,
  dbName: string,
  errorMessage: string
): Promise<void> => {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;

  if (!adminEmail) {
    console.warn('[provision] ADMIN_ALERT_EMAIL not set — skipping alert email');
    return;
  }

  try {
    await sendEmail({
      to:      adminEmail,
      subject: `[Avera] Manual provisioning required — ${companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #e53e3e;">⚠️ Manual provisioning required</h2>
          <p>A new tenant signed up but the database could not be created automatically.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; background: #f7f7f7; font-weight: bold;">Tenant ID</td>
              <td style="padding: 8px;">${tenantId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f7f7f7; font-weight: bold;">Company</td>
              <td style="padding: 8px;">${companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f7f7f7; font-weight: bold;">Database name</td>
              <td style="padding: 8px; font-family: monospace;">${dbName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f7f7f7; font-weight: bold;">Error</td>
              <td style="padding: 8px; color: #e53e3e;">${errorMessage}</td>
            </tr>
          </table>

          <h3>Action required:</h3>
          <ol>
            <li>Create the database manually in Hostinger panel:</li>
          </ol>
          <pre style="background: #1a1a1a; color: #68d391; padding: 16px; border-radius: 8px;">
CREATE DATABASE \`${dbName}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;</pre>
          <ol start="2">
            <li>After creating, update tenant status to <strong>active</strong>:</li>
          </ol>
          <pre style="background: #1a1a1a; color: #68d391; padding: 16px; border-radius: 8px;">
UPDATE tenants
SET status = 'active'
WHERE id = ${tenantId};</pre>

          <p style="color: #718096; font-size: 14px; margin-top: 24px;">
            The tenant's account is created and they will be able to log in once the database is ready.
          </p>
        </div>
      `,
    });

    console.log(`[provision] Alert email sent to ${adminEmail}`);
  } catch (emailError: any) {
    console.error('[provision] Failed to send alert email:', emailError?.message);
  }
};