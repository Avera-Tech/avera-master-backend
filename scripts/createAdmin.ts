/**
 * Script para criar o primeiro AdminUser da Avera.
 * Uso: npx ts-node scripts/createAdmin.ts
 *
 * Variáveis de ambiente necessárias (via .env):
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 * Ou passe como args: --name "João" --email joao@avera.com --password secret
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import sequelize from '../src/config/database';
import AdminUser from '../src/models/AdminUser.model';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name     = arg('--name')     ?? process.env.ADMIN_NAME;
  const email    = arg('--email')    ?? process.env.ADMIN_EMAIL;
  const password = arg('--password') ?? process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error('Uso: npx ts-node scripts/createAdmin.ts --name "Nome" --email email@avera.com --password senha');
    process.exit(1);
  }

  await sequelize.authenticate();

  const existing = await AdminUser.findOne({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    console.error(`Já existe um AdminUser com o e-mail "${email}".`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await AdminUser.create({
    name:     name.trim(),
    email:    email.trim().toLowerCase(),
    password: passwordHash,
    active:   true,
  });

  console.log(`AdminUser criado com sucesso! id=${admin.id} email=${admin.email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao criar AdminUser:', err);
  process.exit(1);
});
