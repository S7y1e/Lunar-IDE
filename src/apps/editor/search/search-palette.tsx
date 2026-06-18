import { type KeyboardEvent } from "react";
import styles from "./search.module.scss";
import { ProjectFile } from "../../../lib/filesystem";
import { Command } from "./commands";
import { usePalette, type Scope } from "./use-palette";
import PaletteTabs from "./palette-tabs";
import PaletteResult from "./palette-result";

type Props = {
    path: string;
    commands: Command[];
    initialScope?: Scope;
    onClose: () => void;
    onOpen: (file: ProjectFile) => void;
    onOpenSymbol: (file: string, line: number, column: number) => void;
};

const PLACEHOLDER: Record<Scope, string> = {
    all: "Search Everywhere — files, symbols, actions, text",
    files: "Search files",
    symbols: "Search symbols",
    actions: "Search actions",
    text: "Search text in project",
};

export default function SearchPalette({
    path,
    commands,
    initialScope = "all",
    onClose,
    onOpen,
    onOpenSymbol,
}: Props) {
    const {
        query,
        setQuery,
        effScope,
        selectScope,
        cycleScope,
        items,
        active,
        setActive,
        moveActive,
    } = usePalette(path, commands, initialScope);

    const choose = (index: number) => {
        const item = items[index];
        if (!item) return;
        if (item.kind === "command") item.command.run();
        else if (item.kind === "symbol")
            onOpenSymbol(item.symbol.file, item.symbol.line, item.symbol.column);
        else if (item.kind === "text")
            onOpenSymbol(item.match.file, item.match.line, item.match.column);
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
        } else if (e.key === "Tab") {
            e.preventDefault();
            cycleScope(e.shiftKey ? -1 : 1);
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
                <PaletteTabs scope={effScope} onSelect={selectScope} />

                <input
                    className={styles.paletteInput}
                    value={query}
                    autoFocus
                    spellCheck={false}
                    placeholder={PLACEHOLDER[effScope]}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                />

                <div className={styles.paletteResults}>
                    {items.map((item, i) => {
                        const cls = `${styles.paletteItem} ${
                            i === active ? styles.paletteItemActive : ""
                        }`;
                        if (item.kind === "symbol")
                            return (
                                <div
                                    key={`s:${item.symbol.file}:${item.symbol.line}:${i}`}
                                    className={cls}
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => choose(i)}
                                >
                                    <span className={styles.paletteName}>
                                        {item.symbol.container}.{item.symbol.name}
                                    </span>
                                    <span className={styles.palettePath}>
                                        {item.symbol.file}:{item.symbol.line}
                                    </span>
                                </div>
                            );
                        if (item.kind === "text")
                            return (
                                <div
                                    key={`t:${item.match.file}:${item.match.line}:${i}`}
                                    className={cls}
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => choose(i)}
                                >
                                    <span className={styles.paletteName}>
                                        {item.match.text.trim().slice(0, 80)}
                                    </span>
                                    <span className={styles.palettePath}>
                                        {item.match.file}:{item.match.line}
                                    </span>
                                </div>
                            );
                        if (item.kind === "command")
                            return (
                                <div
                                    key={`c:${item.command.id}`}
                                    className={cls}
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
                            );
                        return (
                            <PaletteResult
                                key={`f:${item.file.path}`}
                                file={item.file}
                                query={query.trim()}
                                active={i === active}
                                onHover={() => setActive(i)}
                                onChoose={() => choose(i)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
