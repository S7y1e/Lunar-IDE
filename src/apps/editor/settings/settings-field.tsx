import styles from "./settings.module.scss";
import { Setting } from "./setting";
import StringListField from "./string-list-field";
import RecordField from "./record-field";
import KeybindField from "./keybind-field";

type Props = {
    setting: Setting;
    value: unknown;
    modified: boolean;
    onChange: (value: unknown) => void;
    onReset: () => void;
};

// Multi-row controls need the full width, so they drop below the label instead
// of sitting in the right-hand control column.
const STACKED_TYPES = new Set(["string[]", "record"]);

export default function SettingsField({
    setting,
    value,
    modified,
    onChange,
    onReset,
}: Props) {
    const stacked = STACKED_TYPES.has(setting.type);
    return (
        <div className={`${styles.field} ${stacked ? styles.fieldStacked : ""}`}>
            <div className={styles.fieldInfo}>
                <div className={styles.fieldHead}>
                    <span className={styles.fieldLabel}>{setting.label}</span>
                    {modified && (
                        <span className={styles.fieldBadge} title="Changed from default">
                            Modified
                        </span>
                    )}
                </div>
                <p className={styles.fieldDesc}>{setting.description}</p>
                <code className={styles.fieldKey}>{setting.key}</code>
            </div>
            <div className={styles.fieldControl}>
                <Control setting={setting} value={value} onChange={onChange} />
                {modified && (
                    <button className={styles.fieldReset} onClick={onReset}>
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
}

function Control({
    setting,
    value,
    onChange,
}: {
    setting: Setting;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (setting.type === "boolean") {
        return <Toggle checked={value as boolean} onChange={onChange} />;
    }

    if (setting.type === "keybind") {
        return <KeybindField value={value as string} onChange={onChange} />;
    }

    if (setting.type === "string" && setting.enum) {
        return (
            <select
                className={styles.select}
                value={value as string}
                onChange={(e) => onChange(e.target.value)}
            >
                {setting.enum.map((option) => (
                    <option key={option} value={option}>
                        {setting.enumLabels?.[option] ?? option}
                    </option>
                ))}
            </select>
        );
    }

    if (setting.type === "string") {
        return (
            <input
                className={styles.input}
                value={value as string}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }

    if (setting.type === "number") {
        return (
            <input
                type="number"
                className={`${styles.input} ${styles.number}`}
                value={value as number}
                min={setting.min}
                max={setting.max}
                onChange={(e) => onChange(e.target.valueAsNumber)}
            />
        );
    }

    if (setting.type === "string[]") {
        return (
            <StringListField
                values={value as string[]}
                onChange={onChange}
            />
        );
    }

    return (
        <RecordField
            entries={value as Record<string, string>}
            onChange={onChange}
        />
    );
}

function Toggle({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
            onClick={() => onChange(!checked)}
        >
            <span className={styles.toggleKnob} />
        </button>
    );
}
