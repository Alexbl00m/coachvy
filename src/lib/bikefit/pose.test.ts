import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MEDIAPIPE_VERSION, toPoseFrame } from "./pose";

describe("toPoseFrame", () => {
  it("räknar normerade punkter till pixlar och tar synligheten som tilltro", () => {
    const landmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i / 100,
      y: 0.5,
      visibility: 0.9,
    }));
    const frame = toPoseFrame(landmarks, 1080, 1920);
    expect(frame?.left.knee).toEqual({ x: 270, y: 960, c: 0.9 });
    expect(frame?.right.ankle.x).toBeCloseTo(302.4, 6);
  });

  it("säger null utan person", () => {
    expect(toPoseFrame(undefined, 100, 100)).toBeNull();
  });
});

describe("MEDIAPIPE_VERSION", () => {
  it("följer det installerade paketet, så att wasm-filerna finns", () => {
    const pkg = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "node_modules/@mediapipe/tasks-vision/package.json",
        ),
        "utf8",
      ),
    );
    expect(pkg.version).toBe(MEDIAPIPE_VERSION);
  });
});
