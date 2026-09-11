"use client";

import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { FileMap } from "@/lib/types";

interface WorkbenchProps {
  initialFiles: Record<string, string>;
}

export function Workbench({ initialFiles }: WorkbenchProps) {
  const [activeFile, setActiveFile] = useState<string>("/App.tsx");
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    setFiles((prev) => ({
      ...prev,
      [activeFile]: value,
    }));
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4">
        <span className="font-semibold tracking-wide">Codey Studio</span>
        <button
          onClick={async () => {
            const res = await fetch("/api/deploy", {
              method: "POST",
              body: JSON.stringify({ files }),
            });
            const data = await res.json();
            window.open(data.url, "_blank");
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition"
        >
          Deploy Site
        </button>
      </header>

      {/* Main Workspace */}
      <SandpackProvider
        template="react-ts"
        theme="dark"
        files={files}
        customSetup={{
          dependencies: {
            "lucide-react": "latest",
            clsx: "latest",
            "tailwind-merge": "latest",
          },
        }}
      >
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* File Explorer */}
          <aside className="col-span-2 border-r border-zinc-800 p-3 flex flex-col gap-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Files
            </p>
            {Object.keys(files).map((filePath) => (
              <button
                key={filePath}
                onClick={() => setActiveFile(filePath)}
                className={`text-left text-sm px-2.5 py-1.5 rounded transition ${
                  activeFile === filePath
                    ? "bg-zinc-800 text-white font-medium"
                    : "text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                {filePath.replace(/^\//, "")}
              </button>
            ))}
          </aside>

          {/* Monaco Editor */}
          <main className="col-span-5 border-r border-zinc-800 flex flex-col">
            <div className="bg-zinc-900 px-4 py-2 text-xs border-b border-zinc-800 text-zinc-400">
              {activeFile}
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                theme="vs-dark"
                path={activeFile}
                defaultLanguage="typescript"
                value={files[activeFile] || ""}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  smoothScrolling: true,
                  automaticLayout: true,
                }}
              />
            </div>
          </main>

          {/* Live Preview Pane */}
          <section className="col-span-5 flex flex-col bg-zinc-900">
            <div className="bg-zinc-900 px-4 py-2 text-xs border-b border-zinc-800 text-zinc-400">
              Live Preview
            </div>
            <div className="flex-1 h-full w-full">
              <SandpackPreview
                style={{ height: "100%", width: "100%" }}
                showOpenInCodeSandbox={false}
                showRefreshButton
              />
            </div>
          </section>
        </div>
      </SandpackProvider>
    </div>
  );
}