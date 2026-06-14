import twilio from "twilio";
import { env } from "../config/env";
import { toWhatsAppAddress } from "../utils/phone";

export interface WhatsAppClient {
  sendText(toPhone: string, body: string): Promise<string>;
  sendMedia(toPhone: string, body: string, mediaUrl: string): Promise<string>;
}

export class TwilioWhatsAppClient implements WhatsAppClient {
  private readonly client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  async sendText(toPhone: string, body: string): Promise<string> {
    const result = await this.client.messages.create({
      from: env.TWILIO_WHATSAPP_FROM,
      to: toWhatsAppAddress(toPhone),
      body
    });
    return result.sid;
  }

  async sendMedia(toPhone: string, body: string, mediaUrl: string): Promise<string> {
    const result = await this.client.messages.create({
      from: env.TWILIO_WHATSAPP_FROM,
      to: toWhatsAppAddress(toPhone),
      body,
      mediaUrl: [mediaUrl]
    });
    return result.sid;
  }
}
