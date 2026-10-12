import { z } from "zod";
import { HttpError } from "../utils/http-error.js";
import { todayWib } from "./season.validator.js";

// Nilai persis enum ExpenseCategory di schema.prisma.
export const EXPENSE_CATEGORIES = ["BENIH", "PUPUK", "OBAT", "TENAGA_KERJA", "LAIN"];
// Kolom amountJt Decimal(10,3); batas wajar satu catatan 100.000 juta Rupiah.
export const MAX_AMOUNT_JT = "100000";

const amountSchema = z
  .union([z.string(), z.number()], { error: "amountJt harus angka (juta Rupiah)" })
  .transform((v) => String(v).trim())
  .refine((s) => /^\d+(\.\d{1,3})?$/.test(s), "amountJt harus angka positif dengan maksimal 3 desimal")
  .refine((s) => Number(s) > 0, "amountJt harus lebih dari 0")
  .refine((s) => Number(s) <= Number(MAX_AMOUNT_JT), `amountJt maksimal ${MAX_AMOUNT_JT} juta`);

export const expenseCreateSchema = z.strictObject(
  {
    category: z.enum(EXPENSE_CATEGORIES, { error: `category wajib dan harus salah satu dari: ${EXPENSE_CATEGORIES.join(", ")}` }),
    amountJt: amountSchema,
    spentOn: z.string({ error: "spentOn wajib berformat YYYY-MM-DD" }),
    note: z.string({ error: "note harus teks" }).trim().max(500, "note maksimal 500 karakter").optional(),
  },
  { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
);

export function parseExpenseCreate(body, now = new Date()) {
  const r = expenseCreateSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.data.spentOn);
  const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  const valid = date && date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3];
  if (!valid) throw new HttpError(400, "spentOn harus tanggal valid berformat YYYY-MM-DD");
  if (date > todayWib(now)) throw new HttpError(400, "Tanggal pengeluaran tidak boleh di masa depan");
  return { category: r.data.category, amountJt: r.data.amountJt, spentOn: date, note: r.data.note };
}
