import argon2 from "argon2";

// bagian 17.7: seed petugas bank. Nilai (nama, HP, sandi) tidak pernah dicetak/dicatat.

/** Baca & validasi input dari env. Mengembalikan { ok, input } atau { ok:false, reason } (reason tanpa nilai). */
export function readBankSeedInput(src) {
  const name = String(src.SEED_BANK_NAME ?? "").trim();
  const rawPhone = String(src.SEED_BANK_PHONE ?? "").trim();
  const password = String(src.SEED_BANK_PASSWORD ?? "");
  if (!name || !rawPhone || !password) {
    return { ok: false, reason: "SEED_BANK_NAME, SEED_BANK_PHONE, atau SEED_BANK_PASSWORD kosong" };
  }
  const phone = rawPhone.replace(/\D/g, ""); // aturan sama dengan register: buang non-angka
  if (phone.length < 8 || phone.length > 15) return { ok: false, reason: "SEED_BANK_PHONE harus 8 sampai 15 digit" };
  if (password.length < 8) return { ok: false, reason: "SEED_BANK_PASSWORD minimal 8 karakter" };
  return { ok: true, input: { name, phone, password } };
}

/**
 * Buat akun PETUGAS_BANK bila belum ada. Idempoten: akun yang sudah ada TIDAK diubah
 * (sandi tidak ditimpa). Mengembalikan "dibuat" | "sudah_ada".
 */
export async function seedBankOfficer(prisma, { name, phone, password }) {
  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) return "sudah_ada";
  const row = await prisma.user.upsert({
    where: { phone },
    update: {}, // jangan timpa apa pun
    create: { name, phone, passwordHash: await argon2.hash(password), role: "PETUGAS_BANK", isGuest: false },
    select: { createdAt: true },
  });
  return row ? "dibuat" : "sudah_ada";
}
