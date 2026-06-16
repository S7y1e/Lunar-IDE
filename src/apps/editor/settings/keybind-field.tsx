import { useState, type KeyboardEvent } from "react";
import { VscClose } from "react-icons/vsc";
import styles from "./settings.module.scss";
import { chordFromEvent } from "./keybinds";

type Props = {
    value: string;
    onChange: (value: string) => void;
};

export default function KeybindField({ value, onChange }: Props) {
    const [capturing, setCapturing] = useState(false);

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (!capturing) return;
        e.preventDefault();
        if (e.key === "Escape") {
            setCapturing(false);
            return;
        }
        const chord = chordFromEvent(e.nativeEvent);
        if (chord) {
            onChange(chord);
            setCapturing(false);
        }
    };

    return (
        <div className={styles.keybind}>
            <button
                type="button"
                className={`${styles.keybindCapture} ${
                    capturing ? styles.keybindCapturing : ""
                }`}
                onClick={() => setCapturing(true)}
                onBlur={() => setCapturing(false)}
                onKeyDown={onKeyDown}
            >
                {capturing ? "Press keys…" : value || "Unbound"}
            </button>
            {value && !capturing && (
                <button
                    className={styles.keybindClear}
                    onClick={() => onChange("")}
                    title="Unbind"
                >
                    <VscClose size={14} />
                </button>
            )}
        </div>
    );
}
