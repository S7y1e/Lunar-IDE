import SearchPalette from "./search/search-palette";
import SettingsView from "./settings/settings-view";
import RenameDialog from "./refactor/rename-dialog";
import Toasts from "./notifications/toasts";
import { type Command } from "./search/commands";
import { type useCommandPalette } from "./search/use-command-palette";
import { type useToasts } from "./notifications/use-toasts";

type Props = {
    path: string;
    palette: ReturnType<typeof useCommandPalette>;
    commands: Command[];
    openFile: (abs: string) => void;
    openFileAt: (relFile: string, line: number, column: number) => void;
    settingsOpen: boolean;
    onCloseSettings: () => void;
    renaming: boolean;
    activeFile: string | null;
    onCloseRename: () => void;
    renameFile: (oldPath: string, newPath: string) => void;
    toasts: ReturnType<typeof useToasts>;
};

export default function EditorOverlays({
    path,
    palette,
    commands,
    openFile,
    openFileAt,
    settingsOpen,
    onCloseSettings,
    renaming,
    activeFile,
    onCloseRename,
    renameFile,
    toasts,
}: Props) {
    return (
        <>
            {palette.isOpen && (
                <SearchPalette
                    path={path}
                    commands={commands}
                    initialScope={palette.initialScope}
                    onClose={palette.close}
                    onOpen={(file) => openFile(file.path)}
                    onOpenSymbol={openFileAt}
                />
            )}

            {settingsOpen && <SettingsView onClose={onCloseSettings} />}

            {renaming && activeFile && (
                <RenameDialog
                    root={path}
                    activeFile={activeFile}
                    onClose={onCloseRename}
                    onDone={(newAbs) => {
                        onCloseRename();
                        if (activeFile) renameFile(activeFile, newAbs);
                        else openFile(newAbs);
                        toasts.push(
                            "success",
                            `Renamed to ${newAbs.split(/[\\/]/).pop()}`,
                            undefined,
                            5000,
                        );
                    }}
                />
            )}

            <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />
        </>
    );
}
