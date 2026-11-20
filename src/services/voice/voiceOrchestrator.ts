import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";
import {
  UserRole,
  ToolExecutionContext,
  getRoleAllowedTools,
  executeToolWithRBAC,
  TOOL_REGISTRY,
} from "../tools/toolRegistry.js";
import { murfFalconService } from "./murfFalconService.js";
import { sseService } from "../events/sseService.js";

export interface VoiceInteractionRequest {
  transcript: string;
  userId: string;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  companyId?: string;
  confirmed?: boolean;
  pendingAction?: {
    toolName: string;
    args: any;
  };
}

export interface VoiceInteractionResponse {
  spokenText: string;
  toolCalled?: string;
  toolResult?: any;
  needsConfirmation?: boolean;
  pendingAction?: {
    toolName: string;
    args: any;
  };
  audioUrl?: string;
  audioBase64?: string;
  ttsVoice: string;
  role: UserRole;
  uiAction?: {
    type: "NAVIGATE_ROLE" | "OPEN_KNOWLEDGE" | "CLOSE_KNOWLEDGE" | "OPEN_ONBOARDING" | "CLOSE_ONBOARDING";
    payload?: any;
  };
}

export class VoiceOrchestrator {
  private genAI: GoogleGenAI | null = null;
  private get modelName(): string {
    return process.env.GEMINI_MODEL || "gemini-3.8-flash";
  }

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key && key.trim().length > 10 && !key.includes("sample")) {
      this.genAI = new GoogleGenAI({ apiKey: key.trim() });
      console.log(` Voice Orchestrator Google Gemini engine connected (${this.modelName}).`);
    } else {
      console.log("ℹ️ No GEMINI_API_KEY set. Voice Orchestrator running in deterministic semantic intent mode.");
    }
  }

  async processVoiceInput(req: VoiceInteractionRequest): Promise<VoiceInteractionResponse> {
    const { transcript, userId, userRole, userName, userEmail, companyId, confirmed, pendingAction } = req;
    console.log(`🎙️ Voice Input from ${userName} (${userRole}): "${transcript}"`);

    const context: ToolExecutionContext = {
      userId,
      userRole,
      userName,
      userEmail,
      companyId,
      confirmed,
    };

    const text = transcript.toLowerCase().trim();

    // ========================================================================
    // 0. GLOBAL HANDS-FREE VOICE NAVIGATION (Operate 100% via Voice)
    // ========================================================================
    if (
      text.includes("switch to hr") ||
      text.includes("switch to human resources") ||
      text.includes("login as sarah") ||
      text.includes("log in as sarah")
    ) {
      const spokenText = "Switching to HR Manager workspace. Good day Sarah!";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: "hr",
        uiAction: { type: "NAVIGATE_ROLE", payload: { role: "hr" } },
      };
    }

    if (
      text.includes("switch to engineering manager") ||
      text.includes("switch to em") ||
      text.includes("switch to manager") ||
      text.includes("login as marcus") ||
      text.includes("log in as marcus")
    ) {
      const spokenText = "Switching to Engineering Manager workspace. Hello Marcus!";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: "engineering_manager",
        uiAction: { type: "NAVIGATE_ROLE", payload: { role: "engineering_manager" } },
      };
    }

    if (
      text.includes("switch to software engineer") ||
      text.includes("switch to swe") ||
      text.includes("switch to engineer") ||
      text.includes("login as rohan") ||
      text.includes("log in as rohan")
    ) {
      const spokenText = "Switching to Software Engineer workspace. Welcome Rohan!";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: "software_engineer",
        uiAction: { type: "NAVIGATE_ROLE", payload: { role: "software_engineer" } },
      };
    }

    if (
      text.includes("switch to admin") ||
      text.includes("switch to founder") ||
      text.includes("founder mode") ||
      text.includes("login as sohail") ||
      text.includes("log in as sohail") ||
      text.includes("login as alex") ||
      text.includes("log in as alex")
    ) {
      const spokenText = "Switching to Founder & Admin workspace. Welcome Sohail!";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: "admin",
        uiAction: { type: "NAVIGATE_ROLE", payload: { role: "admin" } },
      };
    }

    // Voice Drawer Navigation
    if (text.includes("open company knowledge") || text.includes("open knowledge") || text.includes("show policies") || text.includes("view guidelines")) {
      const spokenText = "Opening company knowledge policy drawer.";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: userRole,
        uiAction: { type: "OPEN_KNOWLEDGE" },
      };
    }

    if (text.includes("close company knowledge") || text.includes("close knowledge")) {
      const spokenText = "Closing company knowledge drawer.";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: userRole,
        uiAction: { type: "CLOSE_KNOWLEDGE" },
      };
    }

    if (text.includes("open onboarding") || text.includes("start onboarding") || text.includes("register company workspace")) {
      const spokenText = "Opening company onboarding assistant.";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: userRole,
        uiAction: { type: "OPEN_ONBOARDING" },
      };
    }

    if (text.includes("close onboarding")) {
      const spokenText = "Closing company onboarding.";
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });
      return {
        spokenText,
        ttsVoice: tts.voice,
        role: userRole,
        uiAction: { type: "CLOSE_ONBOARDING" },
      };
    }

    // ========================================================================
    // 1. VERBAL CONFIRMATION HANDLING
    // ========================================================================
    // Normalize pendingAction in case it was passed nested from the client
    let resolvedAction: any = pendingAction;
    if (resolvedAction && resolvedAction.pendingAction) {
      resolvedAction = resolvedAction.pendingAction;
    }
    const targetToolName: string | undefined =
      resolvedAction?.toolName ||
      resolvedAction?.toolCalled ||
      (pendingAction as any)?.toolCalled ||
      resolvedAction?.name;
    const targetArgs: any =
      resolvedAction?.args ||
      resolvedAction?.parameters ||
      (pendingAction as any)?.args ||
      {};

    const isAffirmative = /^(yes|yeah|sure|confirm|proceed|looks good|do it|go ahead|create the workspace|send it|yup|hire|please do|finalize)/i.test(text.trim());
    const isRepeatingSameAction = Boolean(
      targetToolName && (
        (targetToolName === "provision_employee" && (text.includes("hire") || text.includes("priya") || text.includes("provision"))) ||
        (targetToolName === "create_github_issue" && (text.includes("issue") || text.includes("payment") || text.includes("create"))) ||
        (targetToolName === "shortlist_candidates" && (text.includes("shortlist") || text.includes("candidate") || text.includes("backend"))) ||
        (targetToolName === "finalize_workspace" && (text.includes("workspace") || text.includes("create")))
      )
    );

    if (targetToolName && (confirmed || isAffirmative || isRepeatingSameAction)) {
      console.log(` User verbally confirmed action: ${targetToolName}`, targetArgs);
      sseService.sendToUser(userId, "TOOL_CALL_STARTED", {
        toolName: targetToolName,
        status: "EXECUTING_CONFIRMED",
      });

      const toolResult = await executeToolWithRBAC(targetToolName, targetArgs, context);

      sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", {
        toolName: targetToolName,
        result: toolResult,
      });

      const spokenText =
        toolResult.answer ||
        toolResult.message ||
        toolResult.summary ||
        toolResult.briefing ||
        `Action confirmed and completed successfully.`;
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });

      return {
        spokenText,
        toolCalled: targetToolName,
        toolResult,
        needsConfirmation: false,
        audioUrl: tts.audioUrl,
        audioBase64: tts.audioBase64,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // ========================================================================
    // 2. GOOGLE GEMINI TOOL CALLING VIA INTERACTIONS API
    // ========================================================================
    const allowedTools = getRoleAllowedTools(userRole);
    const key = process.env.GEMINI_API_KEY;

    if (key && key.trim().length > 10 && !key.includes("sample")) {
      try {
        const tools = allowedTools.map((t) => ({
          type: "function",
          name: t.name,
          description: t.description,
          parameters: {
            type: "object",
            properties: t.parameters?.properties || {},
            required: t.parameters?.required || [],
          },
        }));

        const candidateModels = [
          this.modelName,
          "gemini-3.8-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.6-flash",
          "gemini-3.5-flash",
        ];
        const uniqueCandidates = [...new Set(candidateModels)];

        let response: { data: any; fnCall?: any; modelOut?: any } | null = null;
        for (const candidate of uniqueCandidates) {
          try {
            const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
              method: "POST",
              headers: {
                "x-goog-api-key": key.trim(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: candidate,
                input: transcript,
                system_instruction: `You are the One Corp Workplace AI Voice Assistant powered by Google Gemini and Murf Falcon TTS.
The logged-in employee is ${userName} (${userEmail}) with role: "${userRole.toUpperCase()}".
Strict RBAC Policy: You only have access to tools permitted for this role: [${allowedTools.map((t) => t.name).join(", ")}].
Do not attempt to execute tools from other roles.
IMPORTANT: When the user requests an action, ALWAYS call the corresponding function tool declaration immediately with the extracted arguments. Do NOT ask for confirmation in plain text; our system runtime enforces verbal confirmation and safety checks before execution.
Keep verbal responses natural, crisp, professional, and workplace-friendly for text-to-speech voice readout. Do not use asterisks or markdown symbols.`,
                tools,
              }),
            });

            if (res.ok) {
              const data: any = await res.json();
              const fnCall = data.steps?.find((s: any) => s.type === "function_call");
              const modelOut = data.steps?.find((s: any) => s.type === "model_output");

              console.log(` Google Gemini responded via Interactions API using model: ${candidate}`);
              response = { data, fnCall, modelOut };
              break;
            } else {
              const errTxt = await res.text();
              console.log(`ℹ️ Cloud candidate ${candidate} note (${res.status}): ${errTxt.slice(0, 90)}`);
              continue;
            }
          } catch (modelErr: any) {
            console.log(`ℹ️ Cloud candidate ${candidate} error: ${modelErr.message}`);
            continue;
          }
        }

        if (!response) {
          console.log(`⚡ Cloud LLM limit reached. Switching to zero-latency local semantic engine for 100% uptime.`);
          return await this.matchIntentLocally(transcript, context);
        }

        if (response.fnCall) {
          const fnName = response.fnCall.name;
          const fnArgs = (response.fnCall.arguments as any) || {};
          const toolDef = TOOL_REGISTRY[fnName];

          if (toolDef?.requiresConfirmation && !confirmed) {
            const confirmPrompt = `I am ready to ${toolDef.name.replace(/_/g, " ")}. Please say 'Confirm' or 'Yes' to proceed.`;
            sseService.sendToUser(userId, "TOOL_CONFIRMATION_REQUESTED", {
              toolName: fnName,
              args: fnArgs,
              prompt: confirmPrompt,
            });

            const tts = await murfFalconService.synthesizeSpeech({ text: confirmPrompt });
            return {
              spokenText: confirmPrompt,
              toolCalled: fnName,
              needsConfirmation: true,
              pendingAction: { toolName: fnName, args: fnArgs },
              audioUrl: tts.audioUrl,
              audioBase64: tts.audioBase64,
              ttsVoice: tts.voice,
              role: userRole,
            };
          }

          // Execute tool directly
          sseService.sendToUser(userId, "TOOL_CALL_STARTED", { toolName: fnName, args: fnArgs });
          const toolResult = await executeToolWithRBAC(fnName, fnArgs, context);
          sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", { toolName: fnName, result: toolResult });

          const spokenText =
            toolResult.answer ||
            toolResult.message ||
            toolResult.summary ||
            toolResult.briefing ||
            `I have completed the ${fnName.replace(/_/g, " ")} task.`;
          const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });

          return {
            spokenText,
            toolCalled: fnName,
            toolResult,
            needsConfirmation: false,
            audioUrl: tts.audioUrl,
            audioBase64: tts.audioBase64,
            ttsVoice: tts.voice,
            role: userRole,
          };
        }

        // If the model gave plain text without calling a tool, check if it was an action intent that has a deterministic handler
        const isActionIntent = /(hire|add|provision|shortlist|candidate|issue|comment|schedule|checklist|send email|email|pull request|standup)/i.test(text);
        if (isActionIntent) {
          console.log(`Action intent detected without tool call. Routing to deterministic intent handler.`);
          return await this.matchIntentLocally(transcript, context);
        }

        const plainReply = response.modelOut?.content?.find((c: any) => c.type === "text")?.text || "I have received and processed your instruction.";
        const tts = await murfFalconService.synthesizeSpeech({ text: plainReply });
        return {
          spokenText: plainReply,
          audioUrl: tts.audioUrl,
          audioBase64: tts.audioBase64,
          ttsVoice: tts.voice,
          role: userRole,
        };
      } catch (err: any) {
        console.warn("Gemini Interactions tool calling error:", err.message);
        return await this.matchIntentLocally(transcript, context);
      }
    }

    // ========================================================================
    // 3. ZERO-CONFIG DETERMINISTIC SEMANTIC INTENT PARSER
    // ========================================================================
    return await this.matchIntentLocally(transcript, context);
  }

  private async matchIntentLocally(transcript: string, context: ToolExecutionContext): Promise<VoiceInteractionResponse> {
    const text = transcript.toLowerCase();
    const { userRole, userId } = context;

    // --- HYBRID VOICE ONBOARDING FLOW ---
    if (text.includes("register company") || text.includes("company name is") || text.includes("founder is") || text.includes("github repo is")) {
      const compMatch = transcript.match(/(?:company|name)(?:\s+is)?\s+([A-Za-z0-9\s]+?)(?:,|\.|\sand\s|$)/i);
      const founderMatch = transcript.match(/(?:founder|founder name)(?:\s+is)?\s+([A-Za-z\s]+?)(?:,|\.|\sand\s|$)/i);
      const emailMatch = transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const repoMatch = transcript.match(/(?:repo|repository)(?:\s+is)?\s+([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i);

      const fields: any = {};
      if (compMatch) fields.companyName = compMatch[1].trim();
      if (founderMatch) fields.founderName = founderMatch[1].trim();
      if (emailMatch) fields.founderEmail = emailMatch[1].trim();
      if (repoMatch) fields.githubRepo = repoMatch[1].trim();

      await executeToolWithRBAC("update_onboarding_form", fields, context);
      const spokenText = `Got it! I have updated the company workspace details on screen. You can review the form and say 'Looks good, create the workspace' to finalize.`;
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenText });

      return {
        spokenText,
        toolCalled: "update_onboarding_form",
        toolResult: { fields },
        needsConfirmation: true,
        pendingAction: {
          toolName: "finalize_workspace",
          args: {
            companyName: fields.companyName || "One Corp",
            founderName: fields.founderName || "Sohail Ansari",
            founderEmail: fields.founderEmail || "sohailansari483@gmail.com",
            githubRepo: fields.githubRepo || "thecodephilic-guy/doc-assistant",
          },
        },
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // --- ADMIN (FOUNDER) INTENTS ---
    if (userRole === "admin" && (text.includes("hire") || text.includes("provision") || text.includes("create role") || text.includes("add"))) {
      const nameMatch = transcript.match(/hire\s+([A-Za-z]+)/i) || transcript.match(/add\s+([A-Za-z]+)/i);
      const emailMatch = transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const roleMatch = text.includes("hr") ? "hr" : text.includes("manager") ? "engineering_manager" : "software_engineer";

      const empName = nameMatch ? nameMatch[1] : "Priya";
      const empEmail = emailMatch ? emailMatch[1] : `${empName.toLowerCase()}@onecorp.ai`;

      const confirmPrompt = `I am ready to hire ${empName} as ${roleMatch.toUpperCase()} and dispatch credentials to ${empEmail}. Please say 'Confirm' or 'Yes' to proceed.`;
      sseService.sendToUser(userId, "TOOL_CONFIRMATION_REQUESTED", {
        toolName: "provision_employee",
        args: { name: empName, email: empEmail, role: roleMatch },
        prompt: confirmPrompt,
      });

      const tts = await murfFalconService.synthesizeSpeech({ text: confirmPrompt });
      return {
        spokenText: confirmPrompt,
        toolCalled: "provision_employee",
        needsConfirmation: true,
        pendingAction: {
          toolName: "provision_employee",
          args: { name: empName, email: empEmail, role: roleMatch },
        },
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    if (userRole === "admin" && (text.includes("pulse") || text.includes("summary of my team") || text.includes("open github issues"))) {
      sseService.sendToUser(userId, "TOOL_CALL_STARTED", { toolName: "get_company_pulse" });
      const pulseResult = await executeToolWithRBAC("get_company_pulse", {}, context);
      sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", { toolName: "get_company_pulse", result: pulseResult });

      const tts = await murfFalconService.synthesizeSpeech({ text: pulseResult.summary });
      return {
        spokenText: pulseResult.summary,
        toolCalled: "get_company_pulse",
        toolResult: pulseResult,
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // --- HR INTENTS ---
    if (userRole === "hr" && (text.includes("schedule") || text.includes("checklist") || text.includes("my day") || text.includes("morning"))) {
      sseService.sendToUser(userId, "TOOL_CALL_STARTED", { toolName: "get_daily_schedule" });
      const schedResult = await executeToolWithRBAC("get_daily_schedule", {}, context);
      sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", { toolName: "get_daily_schedule", result: schedResult });

      const tts = await murfFalconService.synthesizeSpeech({ text: schedResult.greeting });
      return {
        spokenText: schedResult.greeting,
        toolCalled: "get_daily_schedule",
        toolResult: schedResult,
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    if (userRole === "hr" && (text.includes("candidate") || text.includes("shortlist") || text.includes("top 3") || text.includes("applicants"))) {
      const confirmPrompt = `I found top candidates for Backend Engineer. I will render their cards on screen, mark them SHORTLISTED, and dispatch interview invites. Shall I proceed?`;
      sseService.sendToUser(userId, "TOOL_CONFIRMATION_REQUESTED", {
        toolName: "shortlist_candidates",
        args: { role: "Backend Engineer", sendInvites: true },
        prompt: confirmPrompt,
      });

      const tts = await murfFalconService.synthesizeSpeech({ text: confirmPrompt });
      return {
        spokenText: confirmPrompt,
        toolCalled: "shortlist_candidates",
        needsConfirmation: true,
        pendingAction: {
          toolName: "shortlist_candidates",
          args: { role: "Backend Engineer", sendInvites: true },
        },
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // --- ENGINEERING MANAGER (EM) INTENTS ---
    if (userRole === "engineering_manager" && (text.includes("open issues") || text.includes("who is working on what") || text.includes("repo visibility"))) {
      sseService.sendToUser(userId, "TOOL_CALL_STARTED", { toolName: "get_team_repo_visibility" });
      const repoResult = await executeToolWithRBAC("get_team_repo_visibility", {}, context);
      sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", { toolName: "get_team_repo_visibility", result: repoResult });

      const tts = await murfFalconService.synthesizeSpeech({ text: repoResult.summary });
      return {
        spokenText: repoResult.summary,
        toolCalled: "get_team_repo_visibility",
        toolResult: repoResult,
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    if (userRole === "engineering_manager" && (text.includes("create a github issue") || text.includes("assign it to") || text.includes("fix payment webhook timeout"))) {
      const title = text.includes("webhook") ? "Fix payment webhook timeout in stripe integration" : "Fix document indexing pipeline latency and vector search timeout";
      const assigneeName = "Rohan Verma";
      const assigneeEmail = "rohan@onecorp.ai";

      const confirmPrompt = `I am ready to create GitHub issue '${title}' in thecodephilic-guy/doc-assistant, assign it to ${assigneeName}, and email him. Shall I proceed?`;
      sseService.sendToUser(userId, "TOOL_CONFIRMATION_REQUESTED", {
        toolName: "assign_github_task",
        args: { title, assigneeName, assigneeEmail, priority: "HIGH" },
        prompt: confirmPrompt,
      });

      const tts = await murfFalconService.synthesizeSpeech({ text: confirmPrompt });
      return {
        spokenText: confirmPrompt,
        toolCalled: "assign_github_task",
        needsConfirmation: true,
        pendingAction: {
          toolName: "assign_github_task",
          args: { title, assigneeName, assigneeEmail, priority: "HIGH" },
        },
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // --- SOFTWARE ENGINEER (SWE) INTENTS ---
    if (userRole === "software_engineer" && (text.includes("assigned to me") || text.includes("what's assigned") || text.includes("my issues") || text.includes("briefing"))) {
      sseService.sendToUser(userId, "TOOL_CALL_STARTED", { toolName: "get_assigned_work_and_briefing" });
      const sweResult = await executeToolWithRBAC("get_assigned_work_and_briefing", {}, context);
      sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", { toolName: "get_assigned_work_and_briefing", result: sweResult });

      const spokenSummary = `You have ${sweResult.assignedCount} issues assigned to you in thecodephilic-guy/doc-assistant. The most recent is Issue #1: Fix document indexing pipeline latency. Marcus noted that indexing retries are failing after 5 seconds.`;
      const tts = await murfFalconService.synthesizeSpeech({ text: spokenSummary });

      return {
        spokenText: spokenSummary,
        toolCalled: "get_assigned_work_and_briefing",
        toolResult: sweResult,
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    if (userRole === "software_engineer" && (text.includes("comment on issue") || text.includes("root cause") || text.includes("standup"))) {
      const issueNum = 1;
      const comment = "I found the root cause. Traced the bottleneck to synchronous parsing in the ingestion handler. PR is in progress.";
      const confirmPrompt = `I will post your comment to Issue #${issueNum} in thecodephilic-guy/doc-assistant and email Engineering Manager Marcus your standup update. Shall I send it?`;

      sseService.sendToUser(userId, "TOOL_CONFIRMATION_REQUESTED", {
        toolName: "post_issue_update_and_standup",
        args: { issueNumber: issueNum, comment, managerEmail: "marcus@onecorp.ai" },
        prompt: confirmPrompt,
      });

      const tts = await murfFalconService.synthesizeSpeech({ text: confirmPrompt });
      return {
        spokenText: confirmPrompt,
        toolCalled: "post_issue_update_and_standup",
        needsConfirmation: true,
        pendingAction: {
          toolName: "post_issue_update_and_standup",
          args: { issueNumber: issueNum, comment, managerEmail: "marcus@onecorp.ai" },
        },
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // --- UNIVERSAL INTENTS ---
    if (text.includes("send an email") || text.includes("email")) {
      const emailMatch = transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const recipient = emailMatch ? emailMatch[1] : "team@onecorp.ai";
      const subject = "Quick update via Voice Assistant";
      const body = `Hi,\n\nFollowing up on our discussion: ${transcript}\n\nSent via One Corp Voice AI`;

      const confirmPrompt = `I am ready to send an email to ${recipient} with subject "${subject}". Shall I proceed?`;
      sseService.sendToUser(userId, "TOOL_CONFIRMATION_REQUESTED", {
        toolName: "send_email",
        args: { to: recipient, subject, body },
        prompt: confirmPrompt,
      });

      const tts = await murfFalconService.synthesizeSpeech({ text: confirmPrompt });
      return {
        spokenText: confirmPrompt,
        toolCalled: "send_email",
        needsConfirmation: true,
        pendingAction: {
          toolName: "send_email",
          args: { to: recipient, subject, body },
        },
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // RAG / Policy & Question Queries
    const isQuestion = /(policy|leave|sprint|expense|reimburse|vacation|sick|how|what|why|who|when|where|can we|explain|guidelines|rules|hours|holidays)/i.test(text);
    if (isQuestion) {
      sseService.sendToUser(userId, "TOOL_CALL_STARTED", { toolName: "query_company_knowledge", args: { question: transcript } });
      const ragResult = await executeToolWithRBAC("query_company_knowledge", { question: transcript }, context);
      sseService.sendToUser(userId, "TOOL_CALL_COMPLETED", { toolName: "query_company_knowledge", result: ragResult });

      const tts = await murfFalconService.synthesizeSpeech({ text: ragResult.answer });
      return {
        spokenText: ragResult.answer,
        toolCalled: "query_company_knowledge",
        toolResult: ragResult,
        audioUrl: tts.audioUrl,
        ttsVoice: tts.voice,
        role: userRole,
      };
    }

    // Role-Specific Contextual Response (Never generic)
    let roleText = "";
    if (userRole === "software_engineer") {
      roleText = `Rohan, you currently have Issue #1: 'Fix document indexing pipeline latency' in doc-assistant. Marcus noted that indexing retries are failing after 5 seconds. You can say 'What's assigned to me?', 'Comment on issue one', or ask any engineering question.`;
    } else if (userRole === "engineering_manager") {
      roleText = `Marcus, you have 3 open issues in thecodephilic-guy/doc-assistant. You can say 'What open issues do we have and who is working on what?', or 'Create a GitHub issue titled Fix document indexing pipeline latency, assign it to Rohan, and email him'.`;
    } else if (userRole === "hr") {
      roleText = `Sarah, you have 3 candidates to review for Backend Engineer and 4 items on your daily checklist. You can say 'Find top 3 candidates for Backend Engineer' or 'Show my daily schedule'.`;
    } else {
      roleText = `Sohail, as Founder and Admin of One Corp, you can say 'Hire Priya as an HR Manager with email priya@onecorp.ai', 'Give me a summary of my team', or ask for company pulse.`;
    }

    const tts = await murfFalconService.synthesizeSpeech({ text: roleText });

    return {
      spokenText: roleText,
      audioUrl: tts.audioUrl,
      ttsVoice: tts.voice,
      role: userRole,
    };
  }
}

export const voiceOrchestrator = new VoiceOrchestrator();
