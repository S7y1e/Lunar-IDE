import { useState } from "react";
import { type IconType } from "react-icons";
import {
    VscChevronRight,
    VscChevronDown,
    VscSymbolMethod,
    VscSymbolField,
    VscSymbolVariable,
    VscSymbolClass,
    VscSymbolProperty,
    VscSymbolNamespace,
    VscSymbolConstant,
} from "react-icons/vsc";
import type { LspDocumentSymbol } from "../code-editor/luau-lsp/convert";
import styles from "./structure.module.scss";

// LSP SymbolKind (1-based) → icon.
const ICON: Record<number, IconType> = {
    2: VscSymbolNamespace,
    5: VscSymbolClass,
    6: VscSymbolMethod,
    7: VscSymbolProperty,
    8: VscSymbolField,
    12: VscSymbolMethod,
    13: VscSymbolVariable,
    14: VscSymbolConstant,
    22: VscSymbolClass,
};

type Props = {
    symbol: LspDocumentSymbol;
    depth: number;
    onGoTo: (line: number, column: number) => void;
};

export default function StructureNode({ symbol, depth, onGoTo }: Props) {
    const [open, setOpen] = useState(true);
    const children = symbol.children ?? [];
    const Icon = ICON[symbol.kind] ?? VscSymbolMethod;
    const pos = (symbol.selectionRange ?? symbol.range).start;

    return (
        <div>
            <div className={styles.row} style={{ paddingLeft: 8 + depth * 14 }}>
                {children.length > 0 ? (
                    <button className={styles.chevron} onClick={() => setOpen((o) => !o)}>
                        {open ? (
                            <VscChevronDown size={14} />
                        ) : (
                            <VscChevronRight size={14} />
                        )}
                    </button>
                ) : (
                    <span className={styles.chevronSpacer} />
                )}
                <button
                    className={styles.label}
                    onClick={() => onGoTo(pos.line + 1, pos.character + 1)}
                    title={symbol.name}
                >
                    <Icon className={styles.icon} size={14} />
                    <span className={styles.name}>{symbol.name}</span>
                    {symbol.detail && (
                        <span className={styles.detail}>{symbol.detail}</span>
                    )}
                </button>
            </div>
            {open &&
                children.map((child, i) => (
                    <StructureNode
                        key={i}
                        symbol={child}
                        depth={depth + 1}
                        onGoTo={onGoTo}
                    />
                ))}
        </div>
    );
}
