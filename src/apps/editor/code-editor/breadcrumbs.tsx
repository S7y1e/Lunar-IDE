import { VscChevronRight } from "react-icons/vsc";
import styles from "./code-editor.module.scss";

type Props = { path: string; root: string };

export default function Breadcrumbs({ path, root }: Props) {
    const rel = path.startsWith(root) ? path.slice(root.length) : path;
    const segments = rel.split(/[\\/]/).filter(Boolean);
    if (segments.length === 0) return null;

    return (
        <div className={styles.breadcrumbs}>
            {segments.map((seg, i) => {
                const last = i === segments.length - 1;
                return (
                    <span key={i} className={styles.crumb}>
                        {i > 0 && (
                            <VscChevronRight size={12} className={styles.crumbSep} />
                        )}
                        <span className={last ? styles.crumbFile : styles.crumbDir}>
                            {seg}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}
