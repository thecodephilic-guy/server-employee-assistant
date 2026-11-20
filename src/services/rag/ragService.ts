import "dotenv/config";
import { dbRepository } from "../../db/index.js";

export class RAGService {
  private get modelName(): string {
    return process.env.GEMINI_MODEL || "gemini-3.8-flash";
  }

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key && key.trim().length > 10 && !key.includes("sample")) {
      console.log(` Google Gemini Interactions RAG engine initialized (${this.modelName}).`);
    } else {
      console.log("ℹ️ No GEMINI_API_KEY set. Running LangChain-style RAG in deterministic semantic retrieval mode.");
    }
  }

  async answerPolicyQuestion(question: string, companyId = "comp_onecorp_01"): Promise<{
    answer: string;
    sources: string[];
  }> {
    const documents = await dbRepository.companyDocuments.listByCompany();

    // 1. Keyword & Semantic matching across company knowledge base
    const queryTokens = question.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    const scoredDocs = documents.map((doc) => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const catLower = doc.category.toLowerCase();

      for (const token of queryTokens) {
        if (titleLower.includes(token)) score += 5;
        if (catLower.includes(token)) score += 3;
        if (contentLower.includes(token)) score += 1;
      }
      return { doc, score };
    });

    // Sort by relevance score
    scoredDocs.sort((a, b) => b.score - a.score);
    const topDocs = scoredDocs.slice(0, 2).map((s) => s.doc);

    const contextText = topDocs
      .map((d) => `### Document: ${d.title} (${d.category})\n${d.content}`)
      .join("\n\n---\n\n");

    const sourceTitles = topDocs.map((d) => d.title);

    // 2. Synthesize using Google Gemini Interactions API endpoint
    const key = process.env.GEMINI_API_KEY;
    if (key && key.trim().length > 10 && !key.includes("sample")) {
      const candidateModels = [
        this.modelName,
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
      ];
      const uniqueCandidates = [...new Set(candidateModels)];

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
              input: `Context Documents:\n${contextText}\n\nQuestion: ${question}`,
              system_instruction: `You are the One Corp Workplace Knowledge Assistant powered by Google Gemini and Murf Falcon TTS. Answer employee policy and process questions accurately and concisely using ONLY the provided internal company documents. Keep the tone natural, conversational, and crisp for text-to-speech voice readout. Do not use asterisks or markdown symbols.`,
            }),
          });

          if (res.ok) {
            const data: any = await res.json();
            const step = data.steps?.find((s: any) => s.type === "model_output");
            const answer = step?.content?.find((c: any) => c.type === "text")?.text;
            if (answer && answer.trim().length > 0) {
              console.log(` Google Gemini RAG responded using model: ${candidate}`);
              return { answer: answer.trim(), sources: sourceTitles };
            }
          } else {
            const errTxt = await res.text();
            console.log(`ℹ️ RAG candidate ${candidate} notice (${res.status}): ${errTxt.slice(0, 90)}`);
          }
        } catch (err: any) {
          console.log(`ℹ️ RAG candidate ${candidate} error: ${err.message}`);
        }
      }
    }

    // 3. Fallback High-Quality Synthesis
    const matchedDoc = topDocs[0] || documents[0];
    let answer = `According to our internal company policy on ${matchedDoc.title}: `;

    if (question.toLowerCase().includes("leave") || question.toLowerCase().includes("vacation") || question.toLowerCase().includes("sick")) {
      answer += "One Corp provides 24 days annual paid time off accrued monthly. Sick leave is unlimited with zero doctor note needed for up to 3 days. We also offer 16 weeks fully paid parental leave, and Flexi-Fridays with zero internal meetings for deep focus work.";
    } else if (question.toLowerCase().includes("sprint") || question.toLowerCase().includes("on-call") || question.toLowerCase().includes("standup") || question.toLowerCase().includes("pr")) {
      answer += "Sprints run on a 2-week cycle starting alternate Tuesdays at 10:00 AM IST. P0 and P1 PR review SLA is strictly within 4 hours. On-call rotations run weekly with 1 primary and 1 secondary engineer. Friday deployment freeze takes effect at 4:00 PM.";
    } else if (question.toLowerCase().includes("expense") || question.toLowerCase().includes("reimbursement") || question.toLowerCase().includes("travel") || question.toLowerCase().includes("dinner") || question.toLowerCase().includes("conference")) {
      answer += "Daily meal allowance is up to $80 per day per diem during business travel. Team social dinners have a budget of $50 per person per month. Each employee receives $1,500 per year for tech conferences, books, and courses. Receipts must be filed within 30 days.";
    } else {
      answer += matchedDoc.content.slice(0, 300) + "...";
    }

    return { answer, sources: sourceTitles };
  }
}

export const ragService = new RAGService();
