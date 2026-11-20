# Murf AI Falcon TTS Integration

## Overview
Murf AI Falcon TTS (`falcon-2.1`) is a state-of-the-art conversational voice model designed for high-expressiveness, sub-second latency, and realistic conversational cadence.

## Implementation Details
1. **API Integration (`src/services/voice/murfFalconService.ts`)**:
   - Synthesis Endpoint: `https://api.murf.ai/v1/speech/generate`
   - Streaming Endpoint: `https://api.murf.ai/v1/speech/stream`
   - Model Identifier: `modelVersion: "GEN2"` for studio file generation, `"model": "falcon-2.1"` for ultra-low-latency real-time streaming
   - Voice ID: `en-US-natalie` (default female conversational voice) or `pa-IN-harman`, `en-US-carter`, `en-US-miles`
   - Audio format: `MP3` / `WAV` high-fidelity stream

2. **Agora Conversational AI Configuration**:
   When provisioning Agora Conversational AI cloud agents, Murf Falcon is declared as the voice synthesis vendor:
   ```json
   {
     "tts": {
       "vendor": "murf",
       "params": {
         "voice_name": "en-US-natalie",
         "model": "falcon-2.1",
         "api_key": "<MURF_API_KEY>"
       }
     }
   }
   ```

3. **Fallback & Local Streaming**:
   When running without network access or if Murf rate limits occur, the service seamlessly falls back to streaming synthesis, guaranteeing uninterrupted interactive voice operation.
