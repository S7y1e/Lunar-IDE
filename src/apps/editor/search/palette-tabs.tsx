import styles from "./search.module.scss";
import { SCOPES, type Scope } from "./use-palette";

const LABEL: Record<Scope, string> = {
    all: "All",
    files: "Files",
    symbols: "Symbols",
    actions: "Actions",
    text: "Text",
};

export default function PaletteTabs({
    scope,
    onSelect,
}: {
    scope: Scope;
    onSelect: (scope: Scope) => void;
}) {
    return (
        <div className={styles.paletteTabs}>
            {SCOPES.map((s) => (
                <span
                    key={s}
                    className={`${styles.paletteTab} ${
                        s === scope ? styles.paletteTabActive : ""
                    }`}
                    onClick={() => onSelect(s)}
                >
                    {LABEL[s]}
                </span>
            ))}
        </div>
    );
}
