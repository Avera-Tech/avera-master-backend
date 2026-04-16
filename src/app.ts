import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerSetup from './swagger/swagger';

import indexRoute    from './routes/indexRoutes';
import signupRoute   from './routes/signupRoutes';
import authRoute     from './routes/authRoutes';
import internalRoute from './routes/internalRoutes';
import adminRoute    from './routes/adminRoutes';
import planRoute     from './routes/planRoutes';
import inviteRoute   from './routes/inviteRoutes';

require('dotenv').config();

const app: Application = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
};
app.use(cors(corsOptions));

// ─── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/',          indexRoute);
app.use('/signup',    signupRoute);
app.use('/auth',      authRoute);
app.use('/internal',  internalRoute);  // backend-to-backend only
app.use('/admin',     adminRoute);     // Avera admin panel
app.use('/admin/plans',     planRoute);      // Plans CRUD
app.use('/invites',         inviteRoute);    // Public invite token validation

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── SWAGGER ─────────────────────────────────────────────────────────────────
swaggerSetup(app);

export default app;