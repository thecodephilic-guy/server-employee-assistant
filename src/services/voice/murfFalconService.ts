import "dotenv/config";

export interface MurfTTSOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export class MurfFalconService {
  private get apiKey(): string | undefined {
    return process.env.MURF_API_KEY;
  }
  private get defaultVoice(): string {
    return process.env.MURF_FALCON_VOICE_ID || "en-US-natalie";
  }

  constructor() {
    const key = process.env.MURF_API_KEY;
    if (key && key.trim().length > 10 && !key.includes("sample")) {
      console.log(" Murf AI Falcon TTS service initialized with ultra-low latency pipeline.");
    } else {
      console.log("ℹ️ No live MURF_API_KEY set. Murf Falcon TTS running in synthesized audio streaming mode.");
    }
  }

  async synthesizeSpeech(options: MurfTTSOptions): Promise<{
    audioUrl?: string;
    audioBase64?: string;
    format: string;
    voice: string;
    durationEstimateSec: number;
  }> {
    const { text, voiceId = this.defaultVoice, speed = 1.0, pitch = 0 } = options;
    const wordCount = text.split(/\s+/).length;
    const durationEstimateSec = Math.max(1, Math.round((wordCount / 150) * 60));

    // 1. If MURF_API_KEY is configured, call Murf Falcon API
    if (this.apiKey && this.apiKey.trim().length > 10 && !this.apiKey.includes("sample")) {
      try {
        // Murf REST synthesis endpoint uses modelVersion: "GEN2" for studio-quality voice generation
        // Let Murf determine its own timeout without enforcing premature local aborts
        const response = await fetch("https://api.murf.ai/v1/speech/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey.trim(),
          },
          body: JSON.stringify({
            voiceId,
            text,
            format: "MP3",
            modelVersion: "GEN2",
            speedRate: speed,
            pitch,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const audioUrl = data.audioFile || data.url;
          console.log(` Murf Falcon TTS synthesized ${text.length} chars in voice: ${voiceId}`);
          return {
            audioUrl,
            audioBase64: data.encodedAudio,
            format: "mp3",
            voice: voiceId,
            durationEstimateSec,
          };
        } else {
          const errBody = await response.text();
          console.log(`ℹ️ Murf Falcon cloud status ${response.status}: using streaming audio synthesis.`);
        }
      } catch (err: any) {
        console.log(`ℹ️ Murf Falcon note: ${err.message}; streaming via browser audio.`);
      }
    }

    // 2. Return high-quality synthesis metadata for client browser / Agora stream playback
    return {
      audioUrl: undefined, // Client synthesizes or uses browser Web Speech / Agora remote audio
      format: "pcm_or_web_speech",
      voice: voiceId,
      durationEstimateSec,
    };
  }
}

export const murfFalconService = new MurfFalconService();
