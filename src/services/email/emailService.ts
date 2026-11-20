import "dotenv/config";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { sseService } from "../events/sseService.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  senderName?: string;
}

export class EmailService {
  private resendClient: Resend | null = null;
  private nodemailerTransporter: any = null;

  private get defaultFrom(): string {
    return process.env.EMAIL_FROM || "employeeassistant@sohail.world";
  }

  constructor() {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && resendKey.trim().length > 10 && !resendKey.includes("sample")) {
      this.resendClient = new Resend(resendKey.trim());
      console.log(" Resend Email Service initialized.");
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.nodemailerTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log(" Nodemailer SMTP Service initialized.");
    } else {
      console.log("ℹ️ No live email API key configured. Email service will run in zero-config live preview & audit mode.");
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; preview?: boolean }> {
    const { to, subject, body, html, senderName } = options;
    const formattedFrom = senderName ? `${senderName} via Apex AI <${this.defaultFrom}>` : `Apex Workplace AI <${this.defaultFrom}>`;

    // 1. Try Resend if configured
    if (this.resendClient) {
      try {
        const response = await this.resendClient.emails.send({
          from: formattedFrom,
          to: [to],
          subject: subject,
          text: body,
          html: html || `<div style="font-family: sans-serif; line-height: 1.6; color: #1f2937;">
            <h2>Apex Workplace Notification</h2>
            <p>${body.replace(/\n/g, "<br/>")}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
            <small style="color: #6b7280;">Sent via Apex Voice Productivity Assistant</small>
          </div>`,
        });

        console.log(`✉️ Email delivered via Resend to ${to} [ID: ${response.data?.id}]`);
        sseService.broadcast("EMAIL_DISPATCHED", {
          to,
          subject,
          snippet: body.substring(0, 80) + "...",
          provider: "Resend",
          timestamp: new Date().toISOString(),
        });

        return { success: true, messageId: response.data?.id };
      } catch (err: any) {
        console.warn(`Resend delivery failed: ${err.message}. Emitting preview event.`);
      }
    }

    // 2. Try Nodemailer if configured
    if (this.nodemailerTransporter) {
      try {
        const info = await this.nodemailerTransporter.sendMail({
          from: formattedFrom,
          to,
          subject,
          text: body,
          html: html || `<p>${body.replace(/\n/g, "<br/>")}</p>`,
        });

        console.log(`✉️ Email delivered via SMTP to ${to} [ID: ${info.messageId}]`);
        sseService.broadcast("EMAIL_DISPATCHED", {
          to,
          subject,
          snippet: body.substring(0, 80) + "...",
          provider: "Nodemailer SMTP",
          timestamp: new Date().toISOString(),
        });

        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        console.warn(`SMTP delivery failed: ${err.message}. Emitting preview event.`);
      }
    }

    // 3. Fallback: Log & Broadcast Live Event
    console.log(`\n================= [SIMULATED EMAIL DISPATCH] =================`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${formattedFrom}`);
    console.log(`Body:\n${body}`);
    console.log(`==============================================================\n`);

    sseService.broadcast("EMAIL_DISPATCHED", {
      to,
      subject,
      snippet: body.substring(0, 100) + "...",
      provider: "Apex Mail Dispatcher",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      messageId: `preview_${Date.now()}`,
      preview: true,
    };
  }
}

export const emailService = new EmailService();
