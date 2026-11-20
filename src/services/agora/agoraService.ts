import "dotenv/config";
import pkg from "agora-token";
const { RtcTokenBuilder, RtcRole, ConvoAITokenBuilder } = pkg;
import { sseService } from "../events/sseService.js";

export interface AgoraSessionConfig {
  channelName: string;
  userId: string;
  userRole: "admin" | "hr" | "engineering_manager" | "software_engineer";
  userUid?: number;
  agentUid?: number;
}

export class AgoraService {
  private get appId(): string {
    return process.env.AGORA_APP_ID || "";
  }
  private get appCertificate(): string {
    return process.env.AGORA_APP_CERTIFICATE || "";
  }
  private get customerId(): string {
    return process.env.AGORA_CUSTOMER_ID || "";
  }
  private get customerSecret(): string {
    return process.env.AGORA_CUSTOMER_SECRET || "";
  }

  constructor() {
    const id = process.env.AGORA_APP_ID;
    if (id && id.trim().length > 10 && !id.includes("sample")) {
      console.log(" Agora Conversational AI & RTC service initialized.");
    } else {
      console.log("ℹ️ No active AGORA_APP_ID set. Agora service ready in local testing & mock channel token mode.");
    }
  }

  generateRtcToken(channelName: string, uid: number, isPublisher = true): string {
    const expireTimeInSeconds = 3600 * 24; // 24 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;
    const role = isPublisher ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    if (this.appId && this.appCertificate && !this.appId.includes("sample")) {
      try {
        return RtcTokenBuilder.buildTokenWithUid(
          this.appId,
          this.appCertificate,
          channelName,
          uid,
          role,
          privilegeExpiredTs,
          privilegeExpiredTs
        );
      } catch (err: any) {
        console.warn(`Error generating Agora token: ${err.message}. Returning fallback token.`);
      }
    }

    // Mock token for testing without Agora credentials
    return `mock_agora_token_${channelName}_${uid}_${Date.now()}`;
  }

  async startConversationalAgent(config: AgoraSessionConfig) {
    const { channelName, userId, userRole, userUid = 1001, agentUid = 9999 } = config;
    const agentToken = this.generateRtcToken(channelName, agentUid, true);
    const userToken = this.generateRtcToken(channelName, userUid, true);

    console.log(` Spawning Agora Conversational AI Agent for ${userId} (${userRole}) in channel ${channelName}`);

    // If Agora Customer ID & Secret are set, invoke Agora Cloud Conversational AI REST API
    let agentStartedLive = false;
    if (this.customerId && this.customerSecret && this.appId) {
      try {
        const authHeader = `Basic ${Buffer.from(`${this.customerId}:${this.customerSecret}`).toString("base64")}`;
        const response = await fetch(`https://api.agora.io/v1/projects/${this.appId}/agent/join`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_id: `req_${Date.now()}`,
            channel_name: channelName,
            agent_rtc_uid: agentUid.toString(),
            token: agentToken,
            parameters: {
              tts: {
                vendor: "murf",
                params: {
                  voice_name: process.env.MURF_FALCON_VOICE_ID || "en-US-falcon-marcus",
                  model: "falcon",
                  api_key: process.env.MURF_API_KEY,
                },
              },
              llm: {
                url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                api_key: process.env.GEMINI_API_KEY,
                model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
                system_messages: [
                  {
                    role: "system",
                    content: `You are the Apex Tech Workplace AI Voice Assistant powered by Google Gemini and Murf Falcon TTS. The logged-in employee role is ${userRole}. Only invoke tools permitted for this role. Confirm critical actions verbally before finalizing.`,
                  },
                ],
              },
            },
          }),
        });

        if (response.ok) {
          agentStartedLive = true;
          console.log(` Agora Conversational AI cloud agent joined channel ${channelName}`);
        }
      } catch (err: any) {
        console.warn(`Agora REST agent start failed: ${err.message}. Using built-in local conversational orchestrator.`);
      }
    }

    // Broadcast session start to client reactive UI
    sseService.sendToUser(userId, "AGORA_AGENT_READY", {
      channelName,
      agentUid,
      userUid,
      role: userRole,
      ttsEngine: "Murf AI Falcon TTS",
      liveCloudAgent: agentStartedLive,
      timestamp: new Date().toISOString(),
    });

    return {
      channelName,
      userUid,
      agentUid,
      userToken,
      agentToken,
      appId: this.appId || "mock_agora_app_id",
      ttsEngine: "Murf AI Falcon TTS",
      liveCloudAgent: agentStartedLive,
    };
  }

  async stopConversationalAgent(channelName: string, agentUid = 9999) {
    console.log(`🛑 Stopping Agora Conversational Agent in channel ${channelName}`);
    sseService.broadcast("AGORA_AGENT_STOPPED", {
      channelName,
      agentUid,
      timestamp: new Date().toISOString(),
    });
    return { success: true, channelName };
  }
}

export const agoraService = new AgoraService();
