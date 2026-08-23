import fs from "node:fs";
import path from "node:path";

const workerPath = path.resolve("public/sw.js");
const workerMapPath = path.resolve("public/sw.js.map");

if (process.argv.includes("--clean")) {
  fs.rmSync(workerPath, { force: true });
  fs.rmSync(workerMapPath, { force: true });
  process.exit(0);
}

if (!fs.existsSync(workerPath)) {
  throw new Error("Production build did not generate public/sw.js.");
}

const worker = fs.readFileSync(workerPath, "utf8");

if (worker.trim().length === 0) {
  throw new Error("Production build generated an empty public/sw.js.");
}

if (worker.includes("self.__MUNCHBASE_MANIFEST")) {
  throw new Error("Serwist did not inject the precache manifest into public/sw.js.");
}

if (!worker.includes("/offline")) {
  throw new Error("The generated service worker does not precache /offline.");
}

console.log(`Verified ${path.relative(process.cwd(), workerPath)} (${worker.length} bytes).`);
