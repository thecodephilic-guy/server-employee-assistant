# Agora Conversational AI & RTC Architecture

## Overview
This workplace assistant integrates **Agora Conversational AI** and **Agora RTC** to deliver ultra-low latency, full-duplex voice interactions between employees and the workplace assistant.

## Components
1. **Agora RTC Audio Channel**:
   - Each employee session creates or joins an isolated RTC channel (`emp-session-{userId}`).
   - Tokens are generated on demand via `agora-token` (`RtcTokenBuilder.buildTokenWithUid`) with publisher permissions and 24-hour expiration.
   - The Next.js frontend connects using `agora-rtc-sdk-ng` to stream microphone audio and receive remote AI voice audio.

2. **Agora Conversational AI Cloud Agent**:
   - Spawns an AI agent instance in the same channel (`agent_rtc_uid: 9999`).
   - Configured with:
     - **TTS**: Murf AI Falcon TTS (`vendor: "murf"`, `model: "falcon"`, voice: `en-US-falcon-marcus`)
     - **STT**: Whisper / Deepgram real-time transcription
     - **LLM**: Google Gemini (gemini-1.5-flash) with role-specific system prompt and tool manifests
     - **Tool Calling**: Dispatches tool calls to `/api/tools/execute` webhook

3. **Dual-Mode Zero-Config Fallback**:
   - For hackathon evaluation and environments without Agora Cloud Agent subscriptions enabled, the server seamlessly runs the internal **Voice Orchestrator**:
     - Browser audio capture / WebRTC stream
     - Speech-to-text processing
     - Strict RBAC tool execution
     - Murf Falcon TTS synthesis
     - Server-Sent Events (SSE) live updates to Next.js dashboard

## Endpoints
- `POST /api/agora/token`: Generates RTC tokens for user and agent
- `POST /api/agora/session/start`: Initiates agent session in the channel
- `POST /api/agora/session/stop`: Cleans up agent session
