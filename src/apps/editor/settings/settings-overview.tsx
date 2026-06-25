import styles from "./settings.module.scss";
import { NavTool } from "./registry";
import { TOOL_META } from "./settings-meta";

type Props = {
    nav: NavTool[];
    onPick: (id: string) => void;
};

// Landing page for "All settings": instead of dumping every field, present each
// tool as a card with a blurb and its categories as jump-to chips.
export default function SettingsOverview({ nav, onPick }: Props) {
    return (
        <div className={styles.overview}>
            <p className={styles.overviewIntro}>
                Pick an area to configure. Settings are grouped by what they affect, most
                commonly used first.
            </p>
            <div className={styles.cards}>
                {nav.map((tool) => (
                    <div key={tool.name} className={styles.card}>
                        <h3 className={styles.cardTitle}>{tool.name}</h3>
                        <p className={styles.cardBlurb}>{TOOL_META[tool.name]?.blurb}</p>
                        <div className={styles.chips}>
                            {tool.categories.map((category) => (
                                <button
                                    key={category}
                                    className={styles.chip}
                                    onClick={() => onPick(`${tool.name}::${category}`)}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
