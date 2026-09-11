import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, currentFiles } = await req.json();

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

  const result = await generateObject({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    schema: fileSchema,
  });

  return Response.json(result.object);
}