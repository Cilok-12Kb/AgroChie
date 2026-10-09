import { app } from "./src/app.js";
import { env } from "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";

const server = app.listen(env.port, () => console.log(`API siap di http://localhost:${env.port}/api`));

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);