// Lägger MediaPipes wasm-filer i public/, så att posemodellen laddas från
// Coachvys egen domän i stället för ett CDN. Körs före dev och build; filerna
// checkas inte in (public/mediapipe står i .gitignore).
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules/@mediapipe/tasks-vision");
const { version } = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
const target = join(root, "public/mediapipe", version);
if (!existsSync(join(target, "vision_wasm_internal.wasm"))) {
  mkdirSync(target, { recursive: true });
  for (const file of [
    "vision_wasm_internal.js",
    "vision_wasm_internal.wasm",
    "vision_wasm_nosimd_internal.js",
    "vision_wasm_nosimd_internal.wasm",
  ])
    cpSync(join(pkg, "wasm", file), join(target, file));
  console.log(`MediaPipe ${version} → public/mediapipe/${version}`);
}
