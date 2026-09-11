import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { files, projectName = "portfolio-site" } = await req.json();

    if (!files || typeof files !== "object") {
      throw new Error("Missing files payload");
    }

    const formattedFiles = Object.entries(files).map(([file, data]) => {
      if (typeof data !== "string") {
        throw new Error(`File content for ${file} must be a string`);
      }

      return {
        file: file.startsWith("/") ? file.slice(1) : file,
        data: Buffer.from(data, "utf8").toString("base64"),
        encoding: "base64",
      };
    });

    const response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        files: formattedFiles,
        projectSettings: {
          framework: "vite",
        },
      }),
    });

    const deploymentData = await response.json();

    if (!response.ok) {
      throw new Error(deploymentData.error?.message || "Failed to deploy");
    }

    return NextResponse.json({
      success: true,
      url: `https://${deploymentData.url}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}