import fs from "node:fs/promises";
import path from "node:path";
import * as TOML from "@iarna/toml";
import type { ConfigDocument, ConfigView, EffectiveConfig } from "@session-keeper/shared";
import {
  DEFAULT_CONFIG_RELATIVE_PATH,
  DEFAULT_STATE_RELATIVE_PATH,
  LEGACY_CONFIG_RELATIVE_PATH,
  LEGACY_PROJECT_CONFIG_FILENAME,
  LEGACY_STATE_RELATIVE_PATH,
  PROJECT_CONFIG_FILENAME,
} from "@session-keeper/shared";

import { deepMerge, expandHome } from "../util.js";
import type { DeepPartial } from "./defaults.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import {
  mergeConfigDocuments,
  normalizeConfigDocumentInput,
  redactConfigDocument,
  serializeConfigDocument,
} from "./document.js";

async function readTomlFile(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return TOML.parse(content) as Record<string, unknown>;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/**
 * Migrate a `codex-keeper` layout (pre-rename) to the `session-keeper` layout
 * on first run. Copies the user config file, the state directory, and the
 * per-project config file when the new location is absent and the legacy one
 * exists. Read-only fallback: if migration never ran and only the legacy paths
 * exist, the config loader still reads them.
 */
export async function migrateLegacyPaths(options?: {
  cwd?: string;
  configPath?: string;
}): Promise<void> {
  const home = process.env.HOME ?? "";
  const cwd = options?.cwd ?? process.cwd();

  const legacyUserConfig = path.join(home, LEGACY_CONFIG_RELATIVE_PATH);
  const newUserConfig = path.join(home, DEFAULT_CONFIG_RELATIVE_PATH);
  const legacyState = path.join(home, LEGACY_STATE_RELATIVE_PATH);
  const newState = path.join(home, DEFAULT_STATE_RELATIVE_PATH);
  const legacyProjectConfig = path.join(cwd, LEGACY_PROJECT_CONFIG_FILENAME);
  const newProjectConfig = path.join(cwd, PROJECT_CONFIG_FILENAME);

  const migrations: Array<{ from: string; to: string; isDir: boolean }> = [
    { from: legacyUserConfig, to: newUserConfig, isDir: false },
    { from: legacyState, to: newState, isDir: true },
    { from: legacyProjectConfig, to: newProjectConfig, isDir: false },
  ];

  for (const migration of migrations) {
    try {
      await fs.access(migration.to);
      continue; // new location already present; do not overwrite.
    } catch {
      // fall through to migrate.
    }

    try {
      await fs.access(migration.from);
    } catch {
      continue; // no legacy source to migrate.
    }

    await fs.mkdir(path.dirname(migration.to), { recursive: true });
    await fs.cp(migration.from, migration.to, { recursive: migration.isDir });
  }
}

export async function resolveConfigPaths(options?: {
  cwd?: string;
  configPath?: string;
}): Promise<{ cwd: string; userConfigPath: string; projectConfigPath: string }> {
  const cwd = options?.cwd ?? process.cwd();
  const userConfigPath =
    options?.configPath ?? path.join(process.env.HOME ?? "", DEFAULT_CONFIG_RELATIVE_PATH);
  return {
    cwd,
    userConfigPath,
    projectConfigPath: path.join(cwd, PROJECT_CONFIG_FILENAME),
  };
}

export async function loadConfigView(options?: {
  cwd?: string;
  configPath?: string;
  overrides?: Partial<EffectiveConfig>;
  effectiveConfig?: EffectiveConfig;
}): Promise<ConfigView> {
  const paths = await resolveConfigPaths(options);
  const userConfig = normalizeConfigDocumentInput((await readTomlFile(paths.userConfigPath)) ?? {});
  const projectOverride = normalizeConfigDocumentInput(
    (await readTomlFile(paths.projectConfigPath)) ?? {},
  );
  const effective =
    options?.effectiveConfig ??
    (await loadEffectiveConfig({
      cwd: paths.cwd,
      configPath: paths.userConfigPath,
      overrides: options?.overrides,
    }));

  return {
    paths,
    userConfig: redactConfigDocument(userConfig),
    projectOverride: redactConfigDocument(projectOverride),
    effectiveConfig: {
      general: effective.general,
    },
  };
}

export async function writeUserConfig(options: {
  cwd?: string;
  configPath?: string;
  patch: ConfigDocument;
}): Promise<{ userConfigPath: string; userConfig: ConfigDocument }> {
  const paths = await resolveConfigPaths(options);
  const existing = normalizeConfigDocumentInput((await readTomlFile(paths.userConfigPath)) ?? {});
  const merged = mergeConfigDocuments(existing, options.patch);
  await fs.mkdir(path.dirname(paths.userConfigPath), { recursive: true });
  await fs.writeFile(paths.userConfigPath, serializeConfigDocument(merged), "utf8");
  return {
    userConfigPath: paths.userConfigPath,
    userConfig: merged,
  };
}

export async function loadEffectiveConfig(options?: {
  cwd?: string;
  configPath?: string;
  overrides?: Partial<EffectiveConfig>;
}): Promise<EffectiveConfig> {
  await migrateLegacyPaths(options);
  const paths = await resolveConfigPaths(options);
  const userRaw = normalizeConfigDocumentInput((await readTomlFile(paths.userConfigPath)) ?? {});
  const projectRaw = normalizeConfigDocumentInput(
    (await readTomlFile(paths.projectConfigPath)) ?? {},
  );
  const effective = deepMerge(
    deepMerge(
      deepMerge(DEFAULT_CONFIG, userRaw as Partial<EffectiveConfig>),
      projectRaw as Partial<EffectiveConfig>,
    ),
    options?.overrides ?? {},
  );
  const explicitStateDir =
    options?.overrides?.general?.stateDir ??
    projectRaw.general?.stateDir ??
    userRaw.general?.stateDir;

  return {
    general: {
      codexHome: expandHome(effective.general.codexHome ?? DEFAULT_CONFIG.general.codexHome),
      claudeHome: expandHome(effective.general.claudeHome ?? DEFAULT_CONFIG.general.claudeHome),
      stateDir: explicitStateDir
        ? expandHome(explicitStateDir)
        : expandHome(`~/${DEFAULT_STATE_RELATIVE_PATH}`),
      uiLanguage: effective.general.uiLanguage === "en-US" ? "en-US" : "zh-CN",
    },
  };
}

export function buildConfigForTests(overrides?: DeepPartial<EffectiveConfig>): EffectiveConfig {
  return deepMerge(DEFAULT_CONFIG, (overrides ?? {}) as Partial<EffectiveConfig>);
}
