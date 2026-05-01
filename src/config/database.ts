import { Sequelize } from 'sequelize';
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
 
const sharedOptions = {
  dialect: 'mysql' as const,
  dialectModule: require('mysql2'),
  port: 3306,
  timezone: '-03:00',
  pool: { max: 5, min: 2, acquire: 30000, idle: 600000, evict: 60000 },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  retry: { max: 3 },
};
 
// ─── Core — autenticação, usuários, tenants, OTP ─────────────────────────────
export const sequelizeCore = new Sequelize(
  String(process.env.DB_CORE_NAME),
  String(process.env.DB_CORE_USER),
  String(process.env.DB_CORE_PASS),
  { ...sharedOptions, host: process.env.DB_CORE_HOST }
);
 
// ─── Master — configurações, temas, logos, estilos ───────────────────────────
export const sequelizeMaster = new Sequelize(
  String(process.env.DB_MASTER_NAME),
  String(process.env.DB_MASTER_USER),
  String(process.env.DB_MASTER_PASS),
  { ...sharedOptions, host: process.env.DB_MASTER_HOST }
);
 
// Default export aponta para Core (usado pelos models de auth/signup)
export default sequelizeMaster;