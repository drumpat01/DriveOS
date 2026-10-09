import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { compatibilityReady } from "./compatibility-readiness.js";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export type CompatibilitySupervisorOptions = {
  upstream: string;
  publicOrigin: string;
  command: string;
  scriptPath: string;
  startupTimeoutMs: number;
  spawnImpl?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  probe?: (upstream: string, publicOrigin: string, timeoutMs?: number) => Promise<boolean>;
};

export function compatibilitySupervisorCanSpawn(upstream: string) {
  if (!upstream) return false;
  try { return loopbackHosts.has(new URL(upstream).hostname.toLowerCase()); }
  catch { return false; }
}

export class CompatibilitySupervisor {
  private child?: ChildProcess;
  private starting?: Promise<void>;
  started = false;
  constructor(private readonly options: CompatibilitySupervisorOptions) {}

  async ensureStarted() {
    if (!compatibilitySupervisorCanSpawn(this.options.upstream)) return;
    if (this.started && this.child && this.child.exitCode === null) return;
    if (this.starting) return this.starting;
    this.starting = this.spawn().finally(() => { this.starting = undefined; });
    return this.starting;
  }

  stop() {
    this.started = false;
    if (!this.child || this.child.exitCode !== null) return;
    this.child.kill("SIGTERM");
    this.child.kill("SIGKILL");
  }

  private async spawn() {
    const url = new URL(this.options.upstream);
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    const spawnImpl = this.options.spawnImpl || spawn;
    const child = spawnImpl(this.options.command, ["-NoLogo", "-NoProfile", "-File", this.options.scriptPath], {
      env: { ...process.env, PORT: port, DRIVEOS_MODE: "web" },
      stdio: ["ignore", "inherit", "inherit"]
    });
    this.child = child;
    child.once("exit", () => { this.started = false; });
    const probe = this.options.probe || compatibilityReady;
    const deadline = Date.now() + this.options.startupTimeoutMs;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("The PowerShell compatibility process exited before it became ready.");
      if (await probe(this.options.upstream, this.options.publicOrigin, 400)) {
        this.started = true;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    this.stop();
    throw new Error(`The PowerShell compatibility process did not become ready within ${this.options.startupTimeoutMs} ms.`);
  }
}
