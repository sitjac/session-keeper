import { useEffect, useRef, useState } from "react";
import type { ThemeMode } from "../../app-shell/useThemeMode.js";
import { formatWhen, sessionDisplayTitle } from "../../browser-utils.js";
import type { t } from "../../i18n.js";
import type { SessionDetail } from "../../types.js";

export function SessionDetailHeader(props: {
  detail: SessionDetail;
  focusMode: boolean;
  actioning: boolean;
  actionLabel: string | null;
  themeMode: ThemeMode;
  uiLanguage: "en-US" | "zh-CN";
  tt: (key: Parameters<typeof t>[1]) => string;
  onExitFocusMode: () => void;
  onToggleThemeMode: () => void;
  onRename: (name: string) => boolean | Promise<boolean>;
}) {
  const actionLabelLower = props.actionLabel?.toLowerCase();
  const displayTitle = sessionDisplayTitle(props.detail);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRenaming = actionLabelLower?.includes("renaming") ?? false;
  const canSaveRename = draftName.trim().length > 0 && draftName.trim() !== displayTitle;

  useEffect(() => {
    if (!editing) {
      setDraftName(displayTitle);
    }
  }, [displayTitle, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancelEdit = () => {
    setDraftName(displayTitle);
    setEditing(false);
  };

  const submitRename = async () => {
    const nextName = draftName.trim();
    if (!nextName || nextName === displayTitle) {
      return;
    }
    const renamed = await props.onRename(nextName);
    if (renamed !== false) {
      setEditing(false);
    }
  };

  return (
    <header className="view-header chat-header">
      <div className="chat-title-wrap">
        {props.focusMode ? (
          <button className="btn-sm chat-back-btn" onClick={props.onExitFocusMode} type="button">
            ← {props.tt("back")}
          </button>
        ) : null}
        <div className="chat-title-block">
          <p className="panel-kicker">{props.tt("selectedSession")}</p>
          {editing ? (
            <form
              className="session-title-edit"
              onSubmit={(event) => {
                event.preventDefault();
                void submitRename();
              }}
            >
              <label className="sr-only" htmlFor={`session-name-${props.detail.threadId}`}>
                {props.tt("sessionNameInput")}
              </label>
              <input
                className="session-title-input"
                disabled={props.actioning}
                id={`session-name-${props.detail.threadId}`}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
                ref={inputRef}
                type="text"
                value={draftName}
              />
              <div className="session-title-edit-actions">
                <button
                  className="btn-sm primary"
                  disabled={props.actioning || !canSaveRename}
                  type="submit"
                >
                  {isRenaming ? props.tt("renaming") : props.tt("saveRename")}
                </button>
                <button
                  className="btn-sm"
                  disabled={props.actioning}
                  onClick={cancelEdit}
                  type="button"
                >
                  {props.tt("cancelRename")}
                </button>
              </div>
            </form>
          ) : (
            <div className="session-title-row">
              <button
                className="editable-title-button"
                disabled={props.actioning}
                onClick={() => setEditing(true)}
                title={props.tt("renameSession")}
                type="button"
              >
                <h2 className="editable-title">{displayTitle}</h2>
                <span className="sr-only">{props.tt("renameSession")}</span>
              </button>
            </div>
          )}
          <div className="chat-meta-bar">
            <span>{props.detail.cwd ?? props.detail.workspaceLabel}</span>
            <span className="session-source-badge">
              {props.detail.source === "claude"
                ? props.tt("sourceClaude")
                : props.tt("sourceCodex")}
            </span>
            {props.detail.lastAppliedAt ? (
              <span>{formatWhen(props.detail.lastAppliedAt, props.uiLanguage)}</span>
            ) : props.detail.updatedAt ? (
              <span>{formatWhen(props.detail.updatedAt, props.uiLanguage)}</span>
            ) : null}
            <span>{props.detail.threadId}</span>
          </div>
        </div>
        <div className="chat-header-right">
          {!props.focusMode ? (
            <button
              aria-label={
                props.themeMode === "dark"
                  ? props.tt("switchToLightMode")
                  : props.tt("switchToDarkMode")
              }
              className="btn-sm btn-icon"
              onClick={props.onToggleThemeMode}
              title={
                props.themeMode === "dark"
                  ? props.tt("switchToLightMode")
                  : props.tt("switchToDarkMode")
              }
              type="button"
            >
              <span aria-hidden="true">{props.themeMode === "dark" ? "☀" : "☾"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
