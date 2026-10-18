import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".csv")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: `export default ${JSON.stringify(source)};\n`,
      shortCircuit: true
    };
  }
  return nextLoad(url, context);
}
