// Helper murni "minimal satu metode login" (D12). BELUM dipanggil endpoint mana pun; disiapkan untuk
// fitur unlink Google / hapus email / ganti email nanti. Tanpa akses DB.
//
// Metode login:
//  1. password: passwordHash ada DAN (phone ada ATAU email ada) -> butuh identifier untuk masuk.
//  2. Google: googleId ada.

const has = (v) => v !== null && v !== undefined && v !== "";

/** Jumlah metode login (0, 1, atau 2) dari baris user { passwordHash, phone, email, googleId }. */
export function countLoginMethods(user) {
  const u = user ?? {};
  const password = has(u.passwordHash) && (has(u.phone) || has(u.email));
  const google = has(u.googleId);
  return Number(password) + Number(google);
}

/**
 * Apakah perubahan membuat akun TANPA metode login sama sekali? `perubahan` adalah field yang akan
 * ditimpa, mis. { googleId: null } atau { email: null }. Mengembalikan true bila jumlah metode
 * sesudah perubahan = 0 (termasuk akun yang sejak awal tanpa metode: lebih aman diblokir).
 */
export function wouldLoseLastLoginMethod(user, perubahan = {}) {
  return countLoginMethods({ ...(user ?? {}), ...perubahan }) === 0;
}
