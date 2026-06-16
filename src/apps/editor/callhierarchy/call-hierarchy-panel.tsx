import { VscChevronDown } from "react-icons/vsc";
import CallHierarchyNode from "./call-hierarchy-node";
import type { LspPosition } from "../code-editor/luau-lsp/convert";
import styles from "./call-hierarchy.module.scss";

export type CallTarget = { uri: string; position: LspPosition; label: string };

type Props = {
    target: CallTarget | null;
    onOpen: (uri: string, line: number, column: number) => void;
};

export default function CallHierarchyPanel({ target, onOpen }: Props) {
    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Call Hierarchy
                </span>
            </div>
            <div className={styles.body}>
                {!target ? (
                    <div className={styles.empty}>
                        Put the cursor on a function and run “Call Hierarchy”.
                    </div>
                ) : (
                    <CallHierarchyNode
                        key={`${target.uri}:${target.position.line}:${target.position.character}`}
                        label={target.label}
                        fnUri={target.uri}
                        fnPos={target.position}
                        ancestors={new Set()}
                        depth={0}
                        onOpen={onOpen}
                    />
                )}
            </div>
        </div>
    );
}
