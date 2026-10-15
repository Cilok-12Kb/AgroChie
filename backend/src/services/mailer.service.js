import nodemailer from "nodemailer";
import { HttpError } from "../utils/http-error.js";
import { buildLink, googleLinkedTemplate, passwordChangedTemplate, resetPasswordTemplate, verifyEmailTemplate } from "./email-templates.js";

// Mailer berbasis Nodemailer. Konfigurasi dan transport diinjeksi agar tes memakai
// jsonTransport (tanpa SMTP sungguhan). Rahasia (SMTP_PASS) tidak pernah dicatat.

/** Transport SMTP dari konfigurasi env. Dilempar 503 bila SMTP belum dikonfigurasi. */
export function createSmtpTransport(cfg) {
  if (!cfg?.mailConfigured) throw new HttpError(503, "Layanan email belum dikonfigurasi");
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
  });
}

/**
 * @param {object} cfg  { mailFrom, appBaseUrl, passwordResetTtlMinutes, emailVerifyTtlHours, ... }
 * @param {object} [transport]  transport Nodemailer; bila kosong dibuat dari cfg (SMTP).
 */
export function createMailer(cfg, transport) {
  const getTransport = () => (transport ??= createSmtpTransport(cfg));
  const from = cfg.mailFrom;

  async function deliver(to, tpl) {
    return getTransport().sendMail({ from, to, subject: tpl.subject, text: tpl.text, html: tpl.html });
  }

  return {
    async sendVerificationEmail({ to, name, token, lang }) {
      const url = buildLink(cfg.appBaseUrl, "/verify-email", token);
      return deliver(to, verifyEmailTemplate({ lang, name, url, hours: cfg.emailVerifyTtlHours }));
    },
    async sendPasswordResetEmail({ to, name, token, lang }) {
      const url = buildLink(cfg.appBaseUrl, "/reset-password", token);
      return deliver(to, resetPasswordTemplate({ lang, name, url, minutes: cfg.passwordResetTtlMinutes }));
    },
    // [REVISI] langkah 8: pemberitahuan password diganti (tanpa tautan)
    async sendPasswordChangedEmail({ to, name, lang }) {
      return deliver(to, passwordChangedTemplate({ lang, name }));
    },
    // [REVISI] langkah 10: pemberitahuan Google ditautkan (alamat Google sudah tersamar)
    async sendGoogleLinkedEmail({ to, name, masked, when, lang }) {
      return deliver(to, googleLinkedTemplate({ lang, name, masked, when }));
    },
  };
}

let defaultMailer;
/** Mailer bawaan dari env (dimuat malas agar impor modul ini tidak membutuhkan .env). */
export async function getMailer() {
  if (!defaultMailer) {
    const { env } = await import("../config/env.js");
    defaultMailer = createMailer(env);
  }
  return defaultMailer;
}
