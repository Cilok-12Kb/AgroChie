import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

/** Read-only season histories scoped to current owner; no synthetic/demo rows. */
export const historyRoutes = Router();
historyRoutes.use(requireUser);
historyRoutes.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.seasonRecord.findMany({
    where: { season: { farm: { userId: req.userId } } },
    orderBy: { id: 'desc' },
    select: { id: true, seasonId: true, label: true, crop: true, areaHa: true,
      durationWks: true, totalCostJt: true, quality: true, consentTraining: true,
      yieldKg: true, pricePerKg: true },
  });
  res.json(rows);
}));
