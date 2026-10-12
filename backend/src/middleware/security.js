import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

/**
 * bagian 17.8: trust proxy, header keamanan, CORS (hanya alamat frontend, dengan credentials)
 * dan pengurai cookie. Dipasang sebelum pengurai body dan rute.
 * cfg: { trustProxy, frontendOrigin }
 */
export function applySecurity(app, cfg) {
  if (cfg.trustProxy) app.set("trust proxy", cfg.trustProxy);
  app.use(helmet());
  // Origin lain tidak diberi header CORS sama sekali (bukan dibalas dengan alamat frontend).
  app.use(cors({ origin: (origin, cb) => cb(null, origin === cfg.frontendOrigin), credentials: true }));
  app.use(cookieParser());
}
