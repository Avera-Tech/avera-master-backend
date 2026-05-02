import bcrypt from 'bcryptjs';
import { sequelizeMaster } from '../config/database';
import AdminUser from '../models/AdminUser.model';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     || 'Richard Salles';
const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'richard.salles@averatech.com.br';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'coffe123';

async function seed() {
  await sequelizeMaster.authenticate();

  const existing = await AdminUser.findOne({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log(`[seed] Admin "${ADMIN_EMAIL}" já existe — nada a fazer.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await AdminUser.create({
    name:     ADMIN_NAME,
    email:    ADMIN_EMAIL,
    password: hash,
    active:   true,
  });

  console.log(`[seed] Admin criado com sucesso:`);
  console.log(`       Email : ${ADMIN_EMAIL}`);
  console.log(`       Senha : ${ADMIN_PASSWORD}`);
  console.log(`       ⚠️  Troque a senha após o primeiro login!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Erro:', err?.message);
  process.exit(1);
});
