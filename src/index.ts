import app from './app';
import { sequelizeCore, sequelizeMaster } from './config/database';
import { QueryTypes } from 'sequelize';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const PORT = process.env.PORT || 3100;

// ─────────────────────────────────────────────────────────────────────────────
// runMigrations
// Adiciona colunas que não existem em tabelas já criadas.
// Seguro para rodar em todo boot — ignora se a coluna já existir.
// ─────────────────────────────────────────────────────────────────────────────
async function addColumnIfNotExists(
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    await sequelizeMaster.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
      { type: QueryTypes.RAW }
    );
    console.log(`[migration] ${table}.${column} adicionado ✓`);
  } catch (err: any) {
    if (err?.original?.errno === 1060) return; // ER_DUP_FIELDNAME — coluna já existe
    throw err;
  }
}

async function runMigrations(): Promise<void> {
  await addColumnIfNotExists(
    'invites',
    'nome',
    "VARCHAR(150) NULL DEFAULT NULL COMMENT 'Name of the invited person (optional)' AFTER `email`"
  );
  await addColumnIfNotExists(
    'tenants',
    'db_password',
    "VARCHAR(255) NULL DEFAULT NULL COMMENT 'Senha do banco de dados deste tenant' AFTER `db_name`"
  );
  await addColumnIfNotExists(
    'tenants',
    'control_api_url',
    "VARCHAR(255) NULL DEFAULT NULL COMMENT 'URL base da API do Control deste tenant' AFTER `db_password`"
  );

  // Converte tenants.plan de ENUM para VARCHAR — aceita qualquer nome de plano
  try {
    await sequelizeMaster.query(
      "ALTER TABLE `tenants` MODIFY COLUMN `plan` VARCHAR(100) NOT NULL DEFAULT 'starter'",
      { type: QueryTypes.RAW }
    );
    console.log('[migration] tenants.plan convertido para VARCHAR ✓');
  } catch (err: any) {
    if (err?.original?.errno !== 1060) console.warn('[migration] tenants.plan:', err?.original?.sqlMessage ?? err?.message);
  }

  await addColumnIfNotExists(
    'payments',
    'client_id',
    'INT UNSIGNED NULL DEFAULT NULL AFTER `tenant_id`'
  );

  // Adiciona index em client_id após garantir que a coluna existe
  try {
    await sequelizeMaster.query(
      'ALTER TABLE `payments` ADD INDEX `payments_client_id` (`client_id`)',
      { type: QueryTypes.RAW }
    );
    console.log('[migration] payments index client_id adicionado ✓');
  } catch (err: any) {
    if (err?.original?.errno !== 1061) // 1061 = ER_DUP_KEYNAME (index já existe)
      console.warn('[migration] payments index client_id:', err?.original?.sqlMessage ?? err?.message);
  }

  // Make payments.tenant_id nullable to support external-client payments
  try {
    await sequelizeMaster.query(
      'ALTER TABLE `payments` MODIFY COLUMN `tenant_id` INT UNSIGNED NULL DEFAULT NULL',
      { type: QueryTypes.RAW }
    );
    console.log('[migration] payments.tenant_id → nullable ✓');
  } catch (err: any) {
    console.warn('[migration] payments.tenant_id:', err?.original?.sqlMessage ?? err?.message);
  }

  // Remove users e features cujo tenant foi deletado (órfãos de deletes antigos)
  try {
    const [usersResult] = await sequelizeMaster.query(
      'DELETE FROM `users` WHERE `tenant_id` IS NOT NULL AND `tenant_id` NOT IN (SELECT `id` FROM `tenants`)',
      { type: QueryTypes.RAW }
    );
    const affected = (usersResult as any)?.affectedRows ?? 0;
    if (affected > 0) console.log(`[migration] ${affected} user(s) órfão(s) removido(s) ✓`);
  } catch (err: any) {
    console.warn('[migration] cleanup orphan users:', err?.original?.sqlMessage ?? err?.message);
  }

  try {
    await sequelizeMaster.query(
      'DELETE FROM `features` WHERE `tenant_id` IS NOT NULL AND `tenant_id` NOT IN (SELECT `id` FROM `tenants`)',
      { type: QueryTypes.RAW }
    );
  } catch (err: any) {
    console.warn('[migration] cleanup orphan features:', err?.original?.sqlMessage ?? err?.message);
  }

  console.log('[migration] Concluído ✓');
}

Promise.all([
  sequelizeCore.authenticate(),
  sequelizeMaster.authenticate(),
])
  .then(async () => {
    console.log('[DB] Core    → conectado ✓');
    console.log('[DB] Master  → conectado ✓');

    // Cria tabelas novas (não altera as existentes — evita duplicação de indexes)
    await sequelizeMaster.sync();
    console.log('[DB] Tabelas sincronizadas ✓');

    // Migrações pontuais — adiciona colunas sem recriar constraints
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`[SERVER] Avera Backend rodando na porta ${PORT}`);
      console.log(`[DOCS]   http://localhost:${PORT}/api-docs`);
    });
  })