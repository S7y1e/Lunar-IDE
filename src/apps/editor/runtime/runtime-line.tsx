import { Fragment, type ReactNode } from "react";
import styles from "./runtime.module.scss";

type Props = {
    text: string;
    resolve: (dotPath: string) => string | null;
    onOpen: (dotPath: string, line: number) => void;
};

// Matches the two ways Studio prints a source location:
//   Script 'ServerScriptService.main', Line 3   (stack frames)
//   ServerScriptService.main:3                   (inline error prefix)
const PATTERN =
    /Script '([^']+)', Line (\d+)|((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+):(\d+)/g;

export default function RuntimeLine({ text, resolve, onOpen }: Props) {
    const nodes: ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;

    PATTERN.lastIndex = 0;
    while ((match = PATTERN.exec(text)) !== null) {
        const dotPath = match[1] ?? match[3];
        const line = Number(match[2] ?? match[4]);

        if (match.index > last) nodes.push(text.slice(last, match.index));
        last = PATTERN.lastIndex;

        if (resolve(dotPath)) {
            nodes.push(
                <span
                    key={match.index}
                    className={styles.link}
                    onClick={() => onOpen(dotPath, line)}
                    title={`Open ${dotPath}:${line}`}
                >
                    {match[0]}
                </span>
            );
        } else {
            nodes.push(match[0]);
        }
    }
    if (last < text.length) nodes.push(text.slice(last));

    return (
        <>
            {nodes.map((node, i) => (
                <Fragment key={i}>{node}</Fragment>
            ))}
        </>
    );
}
