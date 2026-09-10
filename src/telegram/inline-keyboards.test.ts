import { describe, expect, it } from "vitest";
import { mainMenuKeyboard, managementKeyboard } from "./inline-keyboards.js";

function labels(keyboard: ReturnType<typeof mainMenuKeyboard>): string[] {
  return keyboard.inline_keyboard.flat().map((button) => button.text);
}

describe("inline keyboards", () => {
  it("includes the required telegram-first primary actions", () => {
    const main = labels(mainMenuKeyboard());
    expect(main).toContain("▶️ Start");
    expect(main).toContain("🎛 Management");
    expect(main).toContain("🎬 Video");
    expect(main).toContain("📋 Report");
    expect(main).toContain("❌ Cancel");
    expect(main).toContain("📊 Statistics");
    expect(main).toContain("⚡ Wake");
  });

  it("keeps job submission available from management", () => {
    const main = labels(managementKeyboard());
    expect(main).toContain("📥 Submit job");
    expect(main).toContain("📜 Recent jobs");
  });
});
