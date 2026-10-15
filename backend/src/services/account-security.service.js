import { countLoginMethods, wouldLoseLastLoginMethod } from "../utils/login-methods.js";

// [REVISI] B7: aturan murni perubahan metode login (nomor HP, hapus email, lepas Google).
// Tanpa DB dan tanpa efek samping; service HTTP/DB ditambahkan di langkah berikutnya.

const has = (v) => v !== null && v !== undefined && v !== "";

export const MSG = {
  guest: "Akun tamu tidak dapat mengubah data akun",
  forbidden: "Tidak diizinkan",
  noEmail: "Belum ada email di akun ini",
  noGoogle: "Akun ini belum tertaut ke Google",
  lastMethod: "Tidak bisa menghapus metode masuk terakhir.",
};

/** Jenis re-autentikasi untuk akun ini: "password", "google", atau null bila mustahil. */
export function reauthKindFor(user) {
  if (has(user?.passwordHash)) return "password";
  if (has(user?.googleId)) return "google";
  return null;
}

const deny = (status, message) => ({ allowed: false, reauth: null, noop: false, status, message });
const allow = (reauth, noop = false) => ({ allowed: true, reauth, noop, status: 200, message: null });

/**
 * Putuskan apakah perubahan boleh dilakukan.
 * user: { isGuest, passwordHash, phone, email, googleId }
 * action: { type: "phone", phone } | { type: "removeEmail" } | { type: "unlinkGoogle" }
 * Hasil: { allowed, reauth: "none"|"password"|"google"|null, noop, status, message }
 */
export function planAccountChange(user, action) {
  if (user?.isGuest) return deny(403, MSG.guest);
  const kind = reauthKindFor(user);

  switch (action?.type) {
    case "phone": {
      if (has(user.phone) && action.phone === user.phone) return allow("none", true);
      if (!has(user.phone)) {
        // Menambah: tanpa re-auth, tetapi akun tanpa cara re-auth sama sekali tidak wajar -> tolak.
        return kind ? allow("none") : deny(403, MSG.forbidden);
      }
      return kind ? allow(kind) : deny(403, MSG.forbidden);
    }
    case "removeEmail": {
      if (countLoginMethods(user) === 0) return deny(409, MSG.lastMethod); // baris 13 tabel keputusan
      if (!has(user.email)) return deny(400, MSG.noEmail);
      if (wouldLoseLastLoginMethod(user, { email: null })) return deny(409, MSG.lastMethod);
      return kind ? allow(kind) : deny(403, MSG.forbidden);
    }
    case "unlinkGoogle": {
      if (countLoginMethods(user) === 0) return deny(409, MSG.lastMethod); // baris 13 tabel keputusan
      if (!has(user.googleId)) return deny(400, MSG.noGoogle);
      if (wouldLoseLastLoginMethod(user, { googleId: null })) return deny(409, MSG.lastMethod);
      return kind ? allow(kind) : deny(403, MSG.forbidden);
    }
    default:
      return deny(400, "Aksi tidak dikenal");
  }
}

/** Samarkan nomor HP: *** + 3 digit terakhir. */
export function maskPhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d ? `***${d.slice(-3)}` : "***";
}
