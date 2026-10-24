import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrateLegacyPaths } from "@session-keeper/core";
import {
  DEFAULT_CONFIG_RELATIVE_PATH,
  DEFAULT_STATE_RELATIVE_PATH,
  LEGACY_CONFIG_RELATIVE_PATH,
  LEGACY_PROJECT_CONFIG_FILENAME,
  LEGACY_STATE_RELATIVE_PATH,
} from "@session-keeper/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REAL_HOME = process.env.HOME ?? "";

describe("migrateLegacyPaths", () => {
  let fakeHome: string;
  let fakeCwd: string;

  beforeEach(async () => {
    fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "csm-home-"));
    fakeCwd = await fs.mkdtemp(path.join(os.tmpdir(), "csm-cwd-"));
    process.env.HOME = fakeHome;
  });

  afterEach(() => {
    process.env.HOME = REAL_HOME;
  });

  it("copies legacy user config, state dir, and project config to new locations", async () => {
    const legacyConfig = path.join(fakeHome, LEGACY_CONFIG_RELATIVE_PATH);
    const legacyState = path.join(fakeHome, LEGACY_STATE_RELATIVE_PATH);
    const legacyProjectConfig = path.join(fakeCwd, LEGACY_PROJECT_CONFIG_FILENAME);

    await fs.mkdir(path.dirname(legacyConfig), { recursive: true });
    await fs.writeFile(legacyConfig, 'general = { codex_home = "~/.codex" }\n', "utf8");
    await fs.mkdir(legacyState, { recursive: true });
    await fs.writeFile(path.join(legacyState, "state.sqlite"), "stub", "utf8");
    await fs.writeFile(legacyProjectConfig, 'general = { ui_language = "en-US" }\n', "utf8");

    await migrateLegacyPaths({ cwd: fakeCwd });

    await expect(
      fs.readFile(path.join(fakeHome, DEFAULT_CONFIG_RELATIVE_PATH), "utf8"),
    ).resolves.toContain("codex_home");
    await expect(
      fs.readFile(path.join(fakeHome, DEFAULT_STATE_RELATIVE_PATH, "state.sqlite"), "utf8"),
    ).resolves.toBe("stub");
    await expect(
      fs.readFile(path.join(fakeCwd, ".session-keeper.toml"), "utf8"),
    ).resolves.toContain("en-US");
  });

  it("does not overwrite an existing new location", async () => {
    const legacyConfig = path.join(fakeHome, LEGACY_CONFIG_RELATIVE_PATH);
    const newConfig = path.join(fakeHome, DEFAULT_CONFIG_RELATIVE_PATH);

    await fs.mkdir(path.dirname(legacyConfig), { recursive: true });
    await fs.writeFile(legacyConfig, "legacy\n", "utf8");
    await fs.mkdir(path.dirname(newConfig), { recursive: true });
    await fs.writeFile(newConfig, "new\n", "utf8");

    await migrateLegacyPaths({ cwd: fakeCwd });

    await expect(fs.readFile(newConfig, "utf8")).resolves.toBe("new\n");
  });

  it("is a no-op when no legacy paths exist", async () => {
    await expect(migrateLegacyPaths({ cwd: fakeCwd })).resolves.toBeUndefined();
    await expect(
      fs.readFile(path.join(fakeHome, DEFAULT_CONFIG_RELATIVE_PATH), "utf8"),
    ).rejects.toThrow();
  });
});
