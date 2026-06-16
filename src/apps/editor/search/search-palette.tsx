import { type KeyboardEvent } from "react";
import styles from "./search.module.scss";
import { ProjectFile } from "../../../lib/filesystem";
import { Command } from "./commands";
import { usePalette } from "./use-palette";
import PaletteTabs from "./palette-tabs";
import PaletteResult from "./palette-result";

type Props = {
    path: string;
    commands: Command[];
    initialQuery?: string;
    onClose: () => void;
    onOpen: (file: ProjectFile) => void;
};

export default function SearchPalette({
    path,
    commands,
    initialQuery = "",
    onClose,
    onOpen,
}: Props) {
    const { query, setQuery, isCommand, items, active, setActive, moveActive } =
        usePalette(path, commands, initialQuery);

    const choose = (index: number) => {
        const item = items[index];
        if (!item) return;
        if (item.kind === "command") item.command.run();
        else onOpen(item.file);
        onClose();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            moveActive(1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            moveActive(-1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(active);
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div className={styles.paletteOverlay} onClick={onClose}>
            <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
                <PaletteTabs mode={isCommand ? "actions" : "files"} />

                <input
                    className={styles.paletteInput}
                    value={query}
                    autoFocus
                    spellCheck={false}
                    placeholder="Search files — type > for actions"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                />

                <div className={styles.paletteResults}>
                    {items.map((item, i) =>
                        item.kind === "command" ? (
                            <div
                                key={item.command.id}
                                className={`${styles.paletteItem} ${
                                    i === active ? styles.paletteItemActive : ""
                                }`}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => choose(i)}
                            >
                                <span className={styles.paletteName}>
                                    {item.command.title}
                                </span>
                                {item.command.hint && (
                                    <span className={styles.palettePath}>
                                        {item.command.hint}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <PaletteResult
                                key={item.file.path}
                                file={item.file}
                                query={query.trim()}
                                active={i === active}
                                onHover={() => setActive(i)}
                                onChoose={() => choose(i)}
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
