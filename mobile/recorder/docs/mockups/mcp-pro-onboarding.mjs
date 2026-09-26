import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const photo = fileURLToPath(new URL('../../assets/cinematic-membership-photo-v1.jpg', import.meta.url));
const output = fileURLToPath(new URL('./mcp-pro-onboarding.png', import.meta.url));
const width = 390, height = 844;

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#081832" stop-opacity="0.25"/>
      <stop offset="0.48" stop-color="#081832" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#081832"/>
    </linearGradient>
  </defs>
  <rect y="318" width="390" height="526" fill="#081832"/>
  <rect width="390" height="318" fill="url(#heroFade)"/>
  <text x="25" y="36" fill="#f6f0e2" font-family="Arial" font-size="15" font-weight="700">9:41</text>
  <g fill="none" stroke="#f6f0e2" stroke-width="2" stroke-linecap="round">
    <path d="M324 31h3m3-3v3m4-6v6m4-9v9"/>
    <path d="M348 28q5-5 10 0m-7 3q2-2 4 0"/>
    <rect x="367" y="23" width="16" height="9" rx="2"/>
  </g>
  <circle cx="351" cy="70" r="17" fill="#203a63" fill-opacity="0.9" stroke="#6f829d" stroke-opacity="0.7"/>
  <path d="M346 65l10 10m0-10l-10 10" stroke="#f6f0e2" stroke-width="1.7" stroke-linecap="round"/>
  <text x="24" y="191" fill="#d4b15a" font-family="Arial" font-size="11" font-weight="800" letter-spacing="1.8">JOURNEYDECK PRO + MCP</text>
  <text x="24" y="231" fill="#f6f0e2" font-family="Georgia" font-size="30" font-weight="700">Your journeys, ready</text>
  <text x="24" y="266" fill="#f6f0e2" font-family="Georgia" font-size="30" font-weight="700">for a conversation.</text>
  <text x="24" y="292" fill="#d3d9e2" font-family="Arial" font-size="13.5">Connect a supported AI app to explore your</text>
  <text x="24" y="311" fill="#d3d9e2" font-family="Arial" font-size="13.5">private journey archive.</text>

  <rect x="24" y="336" width="342" height="140" rx="20" fill="#132d55" stroke="#6f829d" stroke-opacity="0.55"/>
  <text x="42" y="359" fill="#d4b15a" font-family="Arial" font-size="10" font-weight="800" letter-spacing="1.2">EXAMPLE</text>
  <text x="42" y="384" fill="#f6f0e2" font-family="Arial" font-size="15" font-weight="700">“Which drives had my favorite songs?”</text>
  <path d="M42 400h306" stroke="#6f829d" stroke-opacity="0.55"/>
  <circle cx="55" cy="435" r="16" fill="#d4b15a" fill-opacity="0.15"/>
  <path d="M48 437h14m-14-5h9m-9 10h11" stroke="#d4b15a" stroke-width="1.7" stroke-linecap="round"/>
  <text x="80" y="428" fill="#f6f0e2" font-family="Arial" font-size="13" font-weight="700">JourneyDeck MCP</text>
  <text x="80" y="447" fill="#b6bfcc" font-family="Arial" font-size="12">Journeys, routes, music &amp; memories</text>

  <text x="24" y="511" fill="#d4b15a" font-family="Arial" font-size="10.5" font-weight="800" letter-spacing="1.4">WHAT PRO + MCP UNLOCKS</text>
  <circle cx="43" cy="544" r="18" fill="#d4b15a" fill-opacity="0.14"/>
  <path d="M36 544h14m-6-6l6 6-6 6" fill="none" stroke="#d4b15a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="72" y="540" fill="#f6f0e2" font-family="Arial" font-size="14" font-weight="700">Ask about your drives</text>
  <text x="72" y="558" fill="#b6bfcc" font-family="Arial" font-size="11.5">Find routes, places and soundtracks.</text>
  <path d="M72 575h294" stroke="#6f829d" stroke-opacity="0.4"/>
  <circle cx="43" cy="605" r="18" fill="#d4b15a" fill-opacity="0.14"/>
  <path d="M35 611l5-11 5 5 5-8 3 14" fill="none" stroke="#d4b15a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="72" y="600" fill="#f6f0e2" font-family="Arial" font-size="14" font-weight="700">Explore your whole archive</text>
  <text x="72" y="618" fill="#b6bfcc" font-family="Arial" font-size="11.5">Bring journeys and memories into focus.</text>

  <text x="195" y="659" text-anchor="middle" fill="#b6bfcc" font-family="Arial" font-size="11.5">Includes all Pro features, plus MCP access</text>
  <rect x="24" y="681" width="342" height="56" rx="12" fill="#d4b15a"/>
  <text x="195" y="716" text-anchor="middle" fill="#081832" font-family="Arial" font-size="17" font-weight="800">See Pro + MCP plans</text>
  <text x="195" y="770" text-anchor="middle" fill="#b6bfcc" font-family="Arial" font-size="14" font-weight="700">Not now</text>
  <text x="195" y="800" text-anchor="middle" fill="#8998ae" font-family="Arial" font-size="10.5">Your archive stays in your private iCloud account.</text>
  <rect x="145" y="831" width="100" height="4" rx="2" fill="#f6f0e2"/>
</svg>`);

const hero = await sharp(await readFile(photo)).resize(width, 318, { fit: 'cover' }).toBuffer();
const image = await sharp({ create: { width, height, channels: 4, background: '#081832' } })
  .composite([{ input: hero, top: 0, left: 0 }, { input: overlay, top: 0, left: 0 }])
  .png()
  .toBuffer();
await sharp(image).resize(width * 3, height * 3).png().toFile(output);
console.log(output);
