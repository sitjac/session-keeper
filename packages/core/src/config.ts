export { DEFAULT_CONFIG, type DeepPartial } from "./config/defaults.js";
export {
  mergeConfigDocuments,
  normalizeConfigDocumentInput,
  redactConfigDocument,
  serializeConfigDocument,
} from "./config/document.js";
export {
  buildConfigForTests,
  loadConfigView,
  loadEffectiveConfig,
  migrateLegacyPaths,
  resolveConfigPaths,
  writeUserConfig,
} from "./config/files.js";
