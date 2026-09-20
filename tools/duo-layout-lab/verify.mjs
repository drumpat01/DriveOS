import { access, readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("./", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const dist = resolve(root, "dist");
const required = [
  "index.html", "style.css", "app.js", "model.js", "assets/favicon.png",
  "assets/journeydeck-mark.svg", "assets/screens/home.webp", "assets/screens/memories.webp",
  "assets/screens/soundtracks.webp", "assets/screens/statistics.webp", "assets/screens/ipad-home.png",
  "vendor/three.module.js", "vendor/three.core.js", "vendor/OrbitControls.js", "vendor/THREE-LICENSE.txt"
];

await Promise.all(required.map((file) => access(resolve(dist, file))));
const html = await readFile(resolve(dist, "index.html"), "utf8");
const localReferences = [...html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)].map((match) => match[1]);
await Promise.all(localReferences.map((file) => access(resolve(dist, file))));

const files = await readdir(dist, { recursive: true });
let bytes = 0;
for (const file of files) {
  const details = await stat(resolve(dist, file));
  if (details.isFile()) bytes += details.size;
}

if (!html.includes("Visual approximation only")) throw new Error("Simulator disclaimer is missing");
if (!html.includes("type=\"importmap\"")) throw new Error("Three.js import map is missing");
if (!html.includes("Both app surfaces face into the fold")) throw new Error("Inside-display guidance is missing");
if (!html.includes("One outer screen and one camera back")) throw new Error("Exterior-face guidance is missing");
if (!html.includes("Flat mode")) throw new Error("Flat iPad guidance is missing");
if (!html.includes("Flat portrait")) throw new Error("Flat portrait guidance is missing");
if (!html.includes("Tent mode")) throw new Error("Tent landscape guidance is missing");
console.log(`Verified ${required.length} required files (${(bytes / 1024 / 1024).toFixed(2)} MB).`);
