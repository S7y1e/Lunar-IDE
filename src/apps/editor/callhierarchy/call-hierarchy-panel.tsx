import { useState } from "react";
import { VscChevronDown, VscCallIncoming, VscCallOutgoing } from "react-icons/vsc";
import CallHierarchyNode from "./call-hierarchy-node";
import type { CallTarget, Direction } from "./call-hierarchy";
import styles from "./call-hierarchy.module.scss";

export type { CallTarget };

type Props = {
    target: CallTarget | null;
    onOpen: (file: string, line: number, column: number) => void;
};

export default function CallHierarchyPanel({ target, onOpen }: Props) {
    const [direction, setDirection] = useState<Direction>("callers");

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Call Hierarchy
                </span>
                {target && (
                    <span className={styles.toggle}>
                        <button
                            className={`${styles.toggleBtn} ${direction === "callers" ? styles.toggleBtnActive : ""}`}
                            title="Callers (who calls this)"
                            onClick={() => setDirection("callers")}
                        >
                            <VscCallIncoming size={13} />
                        </button>
                        <button
                            className={`${styles.toggleBtn} ${direction === "callees" ? styles.toggleBtnActive : ""}`}
                            title="Callees (what this calls)"
                            onClick={() => setDirection("callees")}
                        >
                            <VscCallOutgoing size={13} />
                        </button>
                    </span>
                )}
            </div>
            <div className={styles.body}>
                {!target ? (
                    <div className={styles.empty}>
                        Put the cursor on a function and run “Call Hierarchy”.
                    </div>
                ) : (
                    <CallHierarchyNode
                        key={`${direction}:${target.name}`}
                        name={target.name}
                        direction={direction}
                        ancestors={new Set()}
                        depth={0}
                        onOpen={onOpen}
                    />
                )}
            </div>
        </div>
    );
}
