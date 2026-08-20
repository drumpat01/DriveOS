import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let authorizationProcess: ChildProcess | null = null;

export type SpotifyPlayerSession = {
  accessToken: string | null;
  expiresAt: string;
  scope: string;
  playbackReady: boolean;
  missingScopes: string[];
};

function powershellExecutable() {
  return process.platform === "win32" ? "powershell.exe" : "pwsh";
}

function powershellEnvironment() {
  if (process.platform !== "win32") return process.env;
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  return { ...process.env, PSModulePath: path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "Modules") };
}

export async function getSpotifyPlayerSession(root: string): Promise<SpotifyPlayerSession> {
  const script = path.join(root, "tools", "Get-SpotifyPlaybackSession.ps1");
  if (!fs.existsSync(script)) throw new Error("Spotify playback is not configured on this server.");
  const { stdout } = await execFileAsync(powershellExecutable(), [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Root", root
  ], { windowsHide: true, timeout: 30_000, maxBuffer: 128 * 1024, env: powershellEnvironment() });
  const parsed = JSON.parse(stdout.trim()) as SpotifyPlayerSession;
  if (!parsed || typeof parsed.playbackReady !== "boolean" || !Array.isArray(parsed.missingScopes)) {
    throw new Error("Spotify playback returned an invalid session.");
  }
  return parsed;
}

export function startSpotifyPlaybackAuthorization(root: string) {
  if (authorizationProcess && authorizationProcess.exitCode === null) return false;
  const script = path.join(root, "tools", "Start-SpotifyPlaybackAuthorization.ps1");
  if (!fs.existsSync(script)) throw new Error("Spotify authorization is not configured on this server.");
  authorizationProcess = spawn(powershellExecutable(), [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Root", root
  ], { detached: false, windowsHide: true, stdio: "ignore", env: powershellEnvironment() });
  authorizationProcess.once("exit", () => { authorizationProcess = null; });
  authorizationProcess.once("error", () => { authorizationProcess = null; });
  return true;
}
