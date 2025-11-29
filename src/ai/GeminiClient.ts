import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  //   async transcribeConversation(audioData: Blob): Promise<string> {
  //     // Use Web Speech API for transcription
  //     // Send to Gemini for summarization
  //   }

  async generateSummary(transcript: string): Promise<string> {
    const prompt = `Summarize this meeting transcript: ${transcript}`;
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async createActionItems(transcript: string): Promise<string[]> {
    const prompt = `Extract action items from: ${transcript}`;
    const result = await this.model.generateContent(prompt);
    return result.response.text().split("\n").filter(Boolean);
  }

  async analyzeSentiment(transcript: string): Promise<string> {
    const prompt = `Analyze team sentiment (positive/neutral/negative): ${transcript}`;
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}
