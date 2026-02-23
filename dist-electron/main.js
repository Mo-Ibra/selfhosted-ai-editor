import { ipcMain, app, BrowserWindow, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#1e1e2e",
    titleBarStyle: "hidden",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("fs:openFolder", async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
    title: "Open Project Folder"
  });
  return result.canceled ? null : result.filePaths[0];
});
const IGNORED = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-electron",
  ".next",
  "__pycache__",
  ".cache",
  "build",
  "coverage",
  ".venv",
  "venv",
  ".DS_Store",
  "Thumbs.db"
]);
function buildFileTree(dirPath, depth = 0) {
  if (depth > 6) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const nodes = [];
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDir: true,
          children: buildFileTree(fullPath, depth + 1)
        });
      } else {
        nodes.push({ name: entry.name, path: fullPath, isDir: false });
      }
    }
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  } catch {
    return [];
  }
}
ipcMain.handle("fs:readTree", async (_event, folderPath) => {
  return buildFileTree(folderPath);
});
ipcMain.handle("fs:readFile", async (_event, filePath) => {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
});
ipcMain.handle("fs:writeFile", async (_event, filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
});
ipcMain.on("window:minimize", () => win == null ? void 0 : win.minimize());
ipcMain.on("window:maximize", () => {
  if (win == null ? void 0 : win.isMaximized()) win.unmaximize();
  else win == null ? void 0 : win.maximize();
});
ipcMain.on("window:close", () => win == null ? void 0 : win.close());
function buildFileTreeString(nodes, indent = "") {
  let result = "";
  for (const node of nodes) {
    result += `${indent}${node.isDir ? "📁" : "📄"} ${node.name}
`;
    if (node.children) result += buildFileTreeString(node.children, indent + "  ");
  }
  return result;
}
ipcMain.handle("ai:chat", async (event, payload) => {
  const { activeFile, activeFilePath, fileTreeNodes, pinnedFiles, history } = payload;
  const fileTreeStr = buildFileTreeString(fileTreeNodes);
  let pinnedContext = "";
  for (const pf of pinnedFiles) {
    pinnedContext += `
<pinned_file path="${pf.path}">
${pf.content}
</pinned_file>
`;
  }
  const systemPrompt = `You are an expert AI code editor assistant embedded in a desktop IDE.

You have full awareness of the project structure and can read and edit any file.

<project_file_tree>
${fileTreeStr}
</project_file_tree>
${pinnedContext ? `
<pinned_files>${pinnedContext}</pinned_files>` : ""}
<active_file path="${activeFilePath}">
${activeFile}
</active_file>

IMPORTANT RULES:
- When asked to make code changes or edits, you MUST respond with ONLY a valid JSON object in this exact format:
{
  "explanation": "Brief description of what you changed and why",
  "edits": [
    {
      "file": "relative/path/from/project/root.ts",
      "startLine": 1,
      "endLine": 5,
      "newContent": "the new replacement content for these lines"
    }
  ]
}
- TO CREATE A NEW FILE: Use the relative path of the new file. Set startLine: 0 and endLine: 0. The context provided should be empty.
- When answering questions, explaining concepts, or having a conversation (NOT making edits), respond in plain text.
- Line numbers are 1-indexed.
- For insertions, set startLine and endLine to the same line (the line to insert after).
- The "file" field should be the FULL absolute path to the file if it exists, otherwise a relative path from the project root.
- Make minimal, precise edits. Only change what is necessary.`;
  const requestBody = JSON.stringify({
    model: "qwen3-coder:480b-cloud",
    messages: [
      { role: "system", content: systemPrompt },
      ...history
    ],
    stream: true
  });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 11434,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody)
      }
    };
    let fullResponse = "";
    const req = http.request(options, (res) => {
      res.on("data", (chunk) => {
        var _a;
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const token = ((_a = parsed == null ? void 0 : parsed.message) == null ? void 0 : _a.content) ?? "";
            if (token) {
              fullResponse += token;
              event.sender.send("ai:chunk", token);
            }
            if (parsed.done) {
              const trimmed = fullResponse.trim();
              let aiResponse = null;
              const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || trimmed.match(/(\{[\s\S]*\})/);
              if (jsonMatch) {
                try {
                  const parsed2 = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                  if (parsed2.edits && Array.isArray(parsed2.edits)) {
                    aiResponse = {
                      explanation: parsed2.explanation || "",
                      edits: parsed2.edits.map((e, i) => ({
                        id: `edit-${Date.now()}-${i}`,
                        ...e
                      }))
                    };
                  }
                } catch {
                }
              }
              event.sender.send("ai:done", aiResponse);
              resolve();
            }
          } catch {
          }
        }
      });
      res.on("error", (err) => {
        event.sender.send("ai:done", null);
        reject(err);
      });
    });
    req.on("error", (err) => {
      event.sender.send("ai:done", null);
      reject(err);
    });
    req.write(requestBody);
    req.end();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
