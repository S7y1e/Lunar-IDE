import styles from "./search.module.scss";

const TABS = ["All", "Classes", "Files", "Symbols", "Actions", "Text"];

export default function PaletteTabs({
    mode,
}: {
    mode: "files" | "actions" | "symbols";
}) {
    const active =
        mode === "actions" ? "Actions" : mode === "symbols" ? "Symbols" : "Files";
    return (
        <div className={styles.paletteTabs}>
            {TABS.map((tab) => (
                <span
                    key={tab}
                    className={`${styles.paletteTab} ${
                        tab === active ? styles.paletteTabActive : ""
                    }`}
                >
                    {tab}
                </span>
            ))}
        </div>
    );
}
