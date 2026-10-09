import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi nilainya.");
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
};