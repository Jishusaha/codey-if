"use client";

import React, { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Babel from "@babel/standalone";
import Editor from "@monaco-editor/react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface WorkbenchProps {
  projectId: string;
  projectName: string;
  initialFiles: Record<string, string>;
}

function LocalPreview({ files }: { files: Record<string, string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const rootRef = useRef<Root | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const shadowRoot = shadowRootRef.current ?? container.attachShadow({ mode: "open" });
    shadowRootRef.current = shadowRoot;

    const entry = files["/App.js"] || files["/App.jsx"] || files["/App.tsx"];
    const styles = files["/styles.css"] || files["/App.css"] || "";
    if (!entry) {
      shadowRoot.textContent = "Preview requires an App.js, App.jsx, or App.tsx entry file.";
      return;
    }

    try {
      const transformed = Babel.transform(entry, {
        presets: ["react", "env"],
        plugins: ["transform-modules-commonjs"],
      });
      if (!transformed?.code) throw new Error("The preview code could not be transformed.");
      const module = { exports: {} as { default?: React.ComponentType } };
      const requireModule = (name: string) => {
        if (name === "react") return React;
        if (name === "react/jsx-runtime" || name === "react/jsx-dev-runtime") {
          const jsx = (type: React.ElementType, props: Record<string, unknown>, key?: string) =>
            React.createElement(type, { ...props, key });
          const jsxs = (type: React.ElementType, props: Record<string, unknown>, key?: string) => {
            const children = Array.isArray(props.children)
              ? props.children.map((child, index) =>
                  React.isValidElement(child) && child.key == null
                    ? React.cloneElement(child, { key: `preview-${index}` })
                    : child,
                )
              : props.children;
            return React.createElement(type, { ...props, children, key });
          };
          return { jsx, jsxs, jsxDEV: jsxs, Fragment: React.Fragment };
        }
        if (name === "react-dom/client") return { createRoot };
        throw new Error(`Preview dependency not available: ${name}`);
      };

      new Function("require", "module", "exports", transformed.code)(
        requireModule,
        module,
        module.exports,
      );

      const App = module.exports.default;
      if (!App) throw new Error("The preview entry must export a default React component.");

      rootRef.current?.render(null);
      shadowRoot.replaceChildren();
      const style = document.createElement("style");
      style.textContent = styles;
      shadowRoot.appendChild(style);
      const mount = document.createElement("div");
      mount.style.height = "100%";
      mount.style.overflow = "auto";
      mount.style.background = "white";
      mount.style.color = "black";
      mount.style.fontSize = "14px";
      shadowRoot.appendChild(mount);
      rootRef.current = createRoot(mount);
      rootRef.current.render(React.createElement(App));
    } catch (previewError) {
      rootRef.current?.render(null);
      rootRef.current = null;
      shadowRoot.textContent = previewError instanceof Error
        ? previewError.message
        : "Unable to render this preview.";
    }

    return () => {
      rootRef.current?.render(null);
      rootRef.current = null;
    };
  }, [files]);

  return <div ref={containerRef} className="h-full overflow-auto bg-white text-sm text-zinc-900" />;
}

export function Workbench({ projectId, projectName, initialFiles }: WorkbenchProps) {
  const [activeFile, setActiveFile] = useState<string>(
    initialFiles["/App.js"] ? "/App.js" : Object.keys(initialFiles)[0] || "/App.js",
  );
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !activeFile) return;
    setFiles((prev) => ({
      ...prev,
      [activeFile]: value,
    }));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: prompt.trim() },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          currentFiles: files,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.files) {
        throw new Error(data?.error || "Failed to generate project files.");
      }

      const nextFiles = Object.fromEntries(
        data.files.map((item: { path: string; content: string }) => {
          const normalizedPath = item.path.startsWith("/") ? item.path : `/${item.path}`;
          return [normalizedPath, item.content];
        })
      );

      setFiles((prev) => ({ ...prev, ...nextFiles }));
      setMessages((prev) => [
        ...prev,
        { role: "user", content: prompt.trim() },
        { role: "assistant", content: data.explanation || "Updated the project files." },
      ]);

      const firstUpdatedPath = Object.keys(nextFiles)[0];
      if (firstUpdatedPath) setActiveFile(firstUpdatedPath);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while generating the site.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save project.");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeploy = async () => {
    try {
      setError(null);
      const saved = await handleSave();
      if (!saved) return;
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, projectId, projectName }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Deployment failed.");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-zinc-950 text-white">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">Live</span>
          SmartDEploy Studio
        </div>
        <button
          onClick={handleDeploy}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Deploy Site
        </button>
      </header>

        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          <aside className="col-span-2 border-r border-zinc-800 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Files
            </p>
            <div className="flex flex-col gap-1">
              {Object.keys(files).map((filePath) => (
                <button
                  key={filePath}
                  onClick={() => setActiveFile(filePath)}
                  className={`rounded px-2.5 py-1.5 text-left text-sm transition ${
                    activeFile === filePath
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  {filePath.replace(/^\//, "")}
                </button>
              ))}
            </div>
          </aside>

          <main className="col-span-5 border-r border-zinc-800">
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
              {activeFile}
            </div>
            <div className="h-[calc(100%-42px)]">
              <Editor
                height="100%"
                theme="vs-dark"
                path={activeFile}
                defaultLanguage={activeFile.endsWith(".css") ? "css" : "javascript"}
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

          <section className="col-span-5 flex flex-col bg-zinc-900">
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
              AI Builder + Preview
            </div>

            <div className="flex flex-1 flex-col gap-3 p-3">
              <div className="flex min-h-0 flex-1 flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Assistant
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {messages.length === 0 ? (
                    <div className="rounded-md border border-dashed border-zinc-700 p-3 text-sm text-zinc-400">
                      Describe the app you want to build, and I’ll generate or revise the files.
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                          message.role === "user"
                            ? "ml-auto bg-emerald-600 text-white"
                            : "bg-zinc-800 text-zinc-200"
                        }`}
                      >
                        {message.content}
                      </div>
                    ))
                  )}
                </div>

                {error ? (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Build a portfolio landing page with a dark theme, projects grid, and contact section..."
                  className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    {savedAt ? `Saved at ${savedAt}` : "Prompt to project"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt.trim()}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-60 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
                <LocalPreview files={files} />
              </div>
            </div>
          </section>
        </div>
    </div>
  );
}