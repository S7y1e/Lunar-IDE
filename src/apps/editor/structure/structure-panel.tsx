import { VscChevronDown } from "react-icons/vsc";
import { useStructure } from "./use-structure";
import StructureNode from "./structure-node";
import styles from "./structure.module.scss";

type Props = {
    activeFile: string | null;
    onGoTo: (line: number, column: number) => void;
};

export default function StructurePanel({ activeFile, onGoTo }: Props) {
    const symbols = useStructure(activeFile);

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Structure
                </span>
            </div>
            <div className={styles.body}>
                {!activeFile ? (
                    <div className={styles.empty}>Open a file to see its structure.</div>
                ) : symbols.length === 0 ? (
                    <div className={styles.empty}>No symbols.</div>
                ) : (
                    symbols.map((symbol, i) => (
                        <StructureNode
                            key={i}
                            symbol={symbol}
                            depth={0}
                            onGoTo={onGoTo}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
