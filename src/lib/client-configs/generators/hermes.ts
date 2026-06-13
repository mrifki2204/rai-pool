import { join } from "node:path";
import { homedir, platform } from "node:os";
import { readFile } from "node:fs/promises";
import type { ProxyConnectionInfo, ClientConfigResult } from "../types";
import { writeText, exists, resolveDefaultModel } from "./utils";

/**
 * Hermes v0.16+ config path.
 * On Windows: %LOCALAPPDATA%\hermes\config.yaml
 * On macOS/Linux: ~/.hermes/config.yaml (fallback)
 */
function getHermesConfigPath(): string {
  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    return join(localAppData, "hermes", "config.yaml");
  }
  return join(homedir(), ".hermes", "config.yaml");
}

function getHermesEnvPath(): string {
  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    return join(localAppData, "hermes", ".env");
  }
  return join(homedir(), ".hermes", ".env");
}

export async function configureHermes(
  info: ProxyConnectionInfo
): Promise<Omit<ClientConfigResult, "client">> {
  const configPath = getHermesConfigPath();
  const envPath = getHermesEnvPath();
  const defaultModel = resolveDefaultModel(info);

  try {
    // ── 1. Update config.yaml ──
    const existing = (await exists(configPath))
      ? await readFile(configPath, "utf-8")
      : "";
    const newline = existing.includes("\r\n") ? "\r\n" : "\n";

    let content = existing;

    // Update model section (Hermes v0.16 format)
    const modelBlock = [
      `model:`,
      `  default: ${defaultModel}`,
      `  provider: custom`,
      `  base_url: ${info.openaiBaseUrl}`,
      `  api_key: ${info.apiKey}`,
    ].join(newline);

    // Replace existing model: block or prepend
    if (/^model:/m.test(content)) {
      // Match model: line and all following indented lines (handles \r\n and \n)
      content = content.replace(
        /^model:[ \t]*\r?\n(?:[ \t]+[^\r\n]*\r?\n)*/m,
        modelBlock + newline
      );
    } else {
      content = `${modelBlock}${newline}${content}`;
    }

    const configBackups = await writeText(configPath, content);

    // ── 2. Update .env ──
    let envContent = (await exists(envPath))
      ? await readFile(envPath, "utf-8")
      : "";

    // Update or add OPENAI_API_KEY
    if (/^OPENAI_API_KEY=/m.test(envContent)) {
      envContent = envContent.replace(/^OPENAI_API_KEY=.*/m, `OPENAI_API_KEY=${info.apiKey}`);
    } else {
      envContent = `OPENAI_API_KEY=${info.apiKey}${newline}${envContent}`;
    }

    // Update or add OPENAI_BASE_URL
    if (/^OPENAI_BASE_URL=/m.test(envContent)) {
      envContent = envContent.replace(/^OPENAI_BASE_URL=.*/m, `OPENAI_BASE_URL=${info.openaiBaseUrl}`);
    } else {
      const insertAfterKey = envContent.indexOf("OPENAI_API_KEY=");
      if (insertAfterKey !== -1) {
        const lineEnd = envContent.indexOf("\n", insertAfterKey);
        if (lineEnd !== -1) {
          envContent = envContent.slice(0, lineEnd + 1) + `OPENAI_BASE_URL=${info.openaiBaseUrl}${newline}` + envContent.slice(lineEnd + 1);
        } else {
          envContent += `${newline}OPENAI_BASE_URL=${info.openaiBaseUrl}`;
        }
      } else {
        envContent = `OPENAI_BASE_URL=${info.openaiBaseUrl}${newline}${envContent}`;
      }
    }

    await writeText(envPath, envContent);

    // ── 3. Build preview ──
    const previewYaml = [
      `# ${configPath}`,
      modelBlock,
      ``,
      `# ${envPath}`,
      `# OPENAI_API_KEY=${info.apiKey}`,
      `# OPENAI_BASE_URL=${info.openaiBaseUrl}`,
    ].join(newline);

    return {
      success: true,
      preview: { yaml: previewYaml },
      paths: [configPath, envPath],
      backupPaths: configBackups,
    };
  } catch (error) {
    return {
      success: false,
      paths: [configPath, envPath],
      backupPaths: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
