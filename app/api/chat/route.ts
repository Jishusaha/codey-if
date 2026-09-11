import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, currentFiles } = await req.json();

    const provider = (process.env.AI_PROVIDER || "google").toLowerCase();
    const hasProviderKey = provider === "google"
      ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      : provider === "openai"
        ? Boolean(process.env.OPENAI_API_KEY)
        : false;

    if (!hasProviderKey) {
      return Response.json(
        {
          error: provider === "google"
            ? "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add a Gemini API key to .env.local, or set AI_PROVIDER=openai to use OpenAI."
            : "Missing OPENAI_API_KEY. Add an OpenAI API key to .env.local, or set AI_PROVIDER=google to use Gemini.",
        },
        { status: 500 }
      );
    }

    if (provider !== "google" && provider !== "openai") {
      return Response.json(
        { error: "Unsupported AI_PROVIDER. Use google or openai." },
        { status: 500 },
      );
    }

    const fileSchema = z.object({
      explanation: z.string().describe("Brief description of the changes made."),
      files: z.array(
        z.object({
          path: z.string().describe("Relative file path, e.g., /App.tsx, /styles.css"),
          content: z.string().describe("Complete content of the file"),
        })
      ),
    });

    const systemPrompt = `
You are an expert full-stack developer assistant specialized in building modern portfolio and showcase websites.
Current Project Files:
${JSON.stringify(currentFiles, null, 2)}

Instructions:
1. Generate complete, working code for React (Vite/Next.js conventions).
2. Ensure modern, responsive designs using Tailwind CSS classes.
3. Return the full contents of all files that need to be created or modified.
`;

    const model = provider === "google"
      ? google("gemini-3.6-flash")
      : openai("gpt-4o");

    const result = await generateObject({
      model,
      system: systemPrompt,
      messages,
      schema: fileSchema,
    });

    return Response.json(result.object);
  } catch (error: any) {
    const message = error?.message || "Failed to generate the project files.";
    const isBillingError = /credits|billing|quota|insufficient|resource exhausted/i.test(message);
    const provider = (process.env.AI_PROVIDER || "google").toLowerCase();
    return Response.json(
      {
        error: isBillingError
          ? `${provider === "google" ? "Gemini" : "OpenAI"} has no available quota for this key. Add credits or replace the provider key, then try again.`
          : message,
      },
      { status: isBillingError ? 503 : 500 }
    );
  }
}