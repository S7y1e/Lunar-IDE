import styles from "./layout.module.scss";
import type { Dock, Slot } from "./layout-types";

// Shown while dragging a tool window. Three edge bands, each split into a main
// (slot a) and split (slot b) drop zone. The drag logic (useDockDrag) hit-tests
// these via [data-zone] and highlights the one under the pointer through `hot`.
export default function DropOverlay({ hot }: { hot: string | null }) {
    const zone = (dock: Dock, slot: Slot) => {
        const id = `${dock}.${slot}`;
        return (
            <div
                data-zone={id}
                className={`${styles.zone} ${hot === id ? styles.zoneHot : ""}`}
            />
        );
    };

    return (
        <div className={styles.overlay}>
            <div className={`${styles.band} ${styles.bandLeft}`}>
                {zone("left", "a")}
                {zone("left", "b")}
            </div>
            <div className={`${styles.band} ${styles.bandRight}`}>
                {zone("right", "a")}
                {zone("right", "b")}
            </div>
            <div className={`${styles.band} ${styles.bandBottom}`}>
                {zone("bottom", "a")}
                {zone("bottom", "b")}
            </div>
        </div>
    );
}
