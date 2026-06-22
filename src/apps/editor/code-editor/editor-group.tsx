import type { ComponentProps } from "react";
import * as monaco from "monaco-editor";
import { VscSplitHorizontal } from "react-icons/vsc";
import styles from "./code-editor.module.scss";
import EditorTabs from "./editor-tabs";
import EditorPane from "./editor-pane";
import Breadcrumbs from "./breadcrumbs";
import type { EditorGroup as Group } from "./use-editor-groups";

type Props = {
    group: Group;
    root: string;
    active: boolean;
    canSplit: boolean;
    dirtyFiles: Set<string>;
    onSelect: (path: string) => void;
    onClose: (path: string) => void;
    onReorder: (from: number, to: number) => void;
    onFocus: () => void;
    onSplit: () => void;
    onEditorMount: (id: number, editor: monaco.editor.IStandaloneCodeEditor) => void;
    pane: Omit<ComponentProps<typeof EditorPane>, "path" | "onReady">;
};

export default function EditorGroup({
    group,
    root,
    active,
    canSplit,
    dirtyFiles,
    onSelect,
    onClose,
    onReorder,
    onFocus,
    onSplit,
    onEditorMount,
    pane,
}: Props) {
    return (
        <div
            className={`${styles.editorGroup} ${active ? styles.editorGroupActive : ""}`}
            onPointerDown={onFocus}
        >
            {group.files.length > 0 && (
                <div className={styles.groupBar}>
                    <EditorTabs
                        files={group.files}
                        active={group.active}
                        dirtyFiles={dirtyFiles}
                        onSelect={onSelect}
                        onClose={onClose}
                        onReorder={onReorder}
                    />
                    {canSplit && (
                        <button
                            className={styles.splitBtn}
                            title="Split editor right"
                            onClick={onSplit}
                        >
                            <VscSplitHorizontal size={16} />
                        </button>
                    )}
                </div>
            )}
            {group.active && <Breadcrumbs path={group.active} root={root} />}
            <div className={styles.groupArea}>
                <EditorPane
                    path={group.active}
                    onReady={(e) => onEditorMount(group.id, e)}
                    {...pane}
                />
            </div>
        </div>
    );
}
