/**
 * Pengaman tes yang menghapus data: hanya boleh jalan di database yang namanya
 * mengandung "_test". Tidak pernah mencetak URL (bisa memuat sandi).
 */
export function assertTestDatabase(url = process.env.DATABASE_URL) {
  let name = "";
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("DATABASE_URL kosong atau tidak valid; tes database dibatalkan.");
  }
  if (!name.includes("_test")) {
    throw new Error('Tes ini hanya boleh dijalankan pada database yang namanya mengandung "_test".');
  }
}
