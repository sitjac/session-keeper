import type { EffectiveConfig } from "@session-keeper/shared";
import { DEFAULT_STATE_RELATIVE_PATH } from "@session-keeper/shared";

export const DEFAULT_CONFIG: EffectiveConfig = {
  general: {
    codexHome: "~/.codex",
    claudeHome: "~/.claude",
    stateDir: `~/${DEFAULT_STATE_RELATIVE_PATH}`,
    uiLanguage: "zh-CN",
  },
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};
