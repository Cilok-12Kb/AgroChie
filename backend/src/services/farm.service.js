import { prisma } from "../config/prisma.js";

export const createFarm = (userId, data) => prisma.farm.create({ data: { userId, ...data } });
export const listFarms = (userId) => prisma.farm.findMany({ where: { userId }, orderBy: { id: "asc" } });