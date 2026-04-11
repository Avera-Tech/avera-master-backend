import app from './app';
import { sequelizeCore, sequelizeMaster } from './config/database';

require('dotenv').config();

const PORT = process.env.PORT || 3100;

Promise.all([
  sequelizeCore.authenticate(),
  sequelizeMaster.authenticate(),
])
  .then(async () => {
    console.log('[DB] Core    → conectado ✓');
    console.log('[DB] Master  → conectado ✓');

    // ← adicione essa linha
    await sequelizeMaster.sync({ alter: true });
    console.log('[DB] Tabelas sincronizadas ✓');

    app.listen(PORT, () => {
      console.log(`[SERVER] Avera Backend rodando na porta ${PORT}`);
      console.log(`[DOCS]   http://localhost:${PORT}/api-docs`);
    });
  })