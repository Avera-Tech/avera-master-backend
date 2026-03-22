import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response): Response => {
  return res.status(200).json({
    title: 'Avera Backend',
    version: '1.0.0',
    status: 'online',
    docs: '/api-docs',
  });
});

export default router;
