import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerSetup from './swagger/swagger';

import indexRoute from './routes/indexRoutes';
import signupRoute from './routes/signupRoutes';
import authRoute from './routes/authRoutes';

require('dotenv').config();

const app: Application = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ─── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/',       indexRoute);
app.use('/signup', signupRoute);
app.use('/auth',   authRoute);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
});

// ─── SWAGGER ─────────────────────────────────────────────────────────────────
swaggerSetup(app);

export default app;
