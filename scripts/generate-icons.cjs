const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="90" fill="#2f6f4e"/>
  <g fill="#ffffff" transform="translate(256,230)">
    <rect x="-30" y="-100" width="14" height="120" rx="3"/>
    <rect x="16" y="-100" width="14" height="120" rx="3"/>
    <rect x="-60" y="-100" width="120" height="12" rx="3"/>
    <rect x="-16" y="-100" width="12" height="45" rx="3"/>
    <rect x="4" y="-100" width="12" height="45" rx="3"/>
    <circle cx="-23" cy="35" r="9"/>
    <circle cx="23" cy="35" r="9"/>
    <circle cx="-23" cy="-55" r="9"/>
    <circle cx="23" cy="-55" r="9"/>
  </g>
  <text x="256" y="420" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="38" font-weight="bold">M</text>
</svg>`;

async function main() {
  const dir = path.join(__dirname, "..", "public", "icons");
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(dir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
}
main().catch(console.error);
