export function notFound(_req, res) {
  res.status(404).json({ error: "Rute tidak ditemukan" });
}

export function errorHandler(err, _req, res, _next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === "P2002") return res.status(409).json({ error: "Data sudah ada (duplikat)" });
  if (err.code === "P2025") return res.status(404).json({ error: "Data tidak ditemukan" });
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan di server" });
}