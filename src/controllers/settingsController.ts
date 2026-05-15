import { Request, Response } from 'express';
import Setting from '../models/Setting.model';

// Chaves gerenciáveis via painel
const ALLOWED_KEYS = [
  'cielo_merchant_id',
  'cielo_merchant_key',
  'cielo_sandbox',
] as const;

type SettingKey = typeof ALLOWED_KEYS[number];

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/settings
// ─────────────────────────────────────────────────────────────────────────────
export const getSettings = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const rows = await Setting.findAll({ where: { key: [...ALLOWED_KEYS] } });

    const data: Record<string, string | null> = Object.fromEntries(
      ALLOWED_KEYS.map((k) => [k, null])
    );

    for (const row of rows) {
      data[row.key] = row.value;
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[settings/get]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /admin/settings
// ─────────────────────────────────────────────────────────────────────────────
export const updateSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const body = req.body as Record<string, string | null>;

    for (const [key, value] of Object.entries(body)) {
      if (!(ALLOWED_KEYS as readonly string[]).includes(key)) continue;
      await Setting.upsert({ key: key as SettingKey, value: value ?? null });
    }

    return res.json({ success: true, message: 'Configurações salvas.' });
  } catch (error: any) {
    console.error('[settings/update]', error);
    return res.status(500).json({ success: false, error: 'Erro interno', detail: error?.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getSetting — helper interno para outros services
// ─────────────────────────────────────────────────────────────────────────────
export const getSetting = async (key: SettingKey): Promise<string | null> => {
  const row = await Setting.findOne({ where: { key } });
  return row?.value ?? null;
};
