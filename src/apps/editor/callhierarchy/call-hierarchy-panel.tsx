import { VscChevronDown } from "react-icons/vsc";
import CallHierarchyNode from "./call-hierarchy-node";
import type { CallTarget } from "./call-hierarchy";
import styles from "./call-hierarchy.module.scss";

export type { CallTarget };

type Props = {
    target: CallTarget | null;
    onOpen: (file: string, line: number, column: number) => void;
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
                        key={target.name}
                        name={target.name}
                        ancestors={new Set()}
                        depth={0}
                        onOpen={onOpen}
                    />
                )}
            </div>
        </div>
    );
}
