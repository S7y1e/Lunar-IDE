import { useState } from "react";
import { VscCopy, VscCheck } from "react-icons/vsc";
import sdkSource from "../../../../sdk/lunar-inspect.lua?raw";
import styles from "./state.module.scss";

const SNIPPET = `-- adjust the path to wherever you placed the module:
local LunarInspect = require(game.ReplicatedStorage.Shared.LunarInspect)

-- watch any table you own:
LunarInspect.watch("PlayerManager.players", players)`;

function CopyButton({ text, label }: { text: string; label: string }) {
    const [done, setDone] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1400);
        });
    };
    return (
        <button className={styles.copy} onClick={copy}>
            {done ? <VscCheck size={13} /> : <VscCopy size={13} />}
            {done ? "Copied" : label}
        </button>
    );
}

export default function StateGuide() {
    return (
        <div className={styles.guide}>
            <p className={styles.lead}>
                Nothing is watched automatically. Tell your game which tables to stream,
                then run a play-test — snapshots show up here live.
            </p>

            <ol className={styles.steps}>
                <li>
                    <div className={styles.stepHead}>
                        <span>Add the SDK module to your source</span>
                        <CopyButton text={sdkSource} label="Copy SDK module" />
                    </div>
                    Save it in your synced source tree (e.g.{" "}
                    <code>src/shared/LunarInspect.lua</code>) so Rojo/Argon keep it on
                    every sync. Only if you're not syncing, paste it into a{" "}
                    <code>ModuleScript</code> under <code>ReplicatedStorage</code> — a
                    direct paste gets wiped on the next sync.
                </li>
                <li>
                    Enable <code>Game Settings → Security → Allow HTTP Requests</code>.
                </li>
                <li>
                    <div className={styles.stepHead}>
                        <span>Watch a table from any script</span>
                        <CopyButton text={SNIPPET} label="Copy" />
                    </div>
                    <pre className={styles.code}>{SNIPPET}</pre>
                </li>
                <li>Run a play-test. Watched tables refresh here every 0.5s.</li>
            </ol>

            <p className={styles.note}>
                If <code>HttpService</code> blocks <code>127.0.0.1</code>, forward through
                your plugin instead: <code>LunarInspect.setSink(fn)</code>.
            </p>
        </div>
    );
}
