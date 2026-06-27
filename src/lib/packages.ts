import { invoke } from "@tauri-apps/api/core";

export type PackageKind = "shared" | "server" | "dev";

export type Package = {
    alias: string;
    name: string;
    versionReq: string;
    locked: string | null;
    kind: PackageKind;
};

export type PackageList = {
    hasWally: boolean;
    locked: boolean;
    packages: Package[];
};

export type ShellRun = { code: number; output: string };

export function projectPackages(): Promise<PackageList> {
    return invoke("project_packages");
}

export function packageAdd(spec: string, kind: PackageKind): Promise<void> {
    return invoke("package_add", { spec, kind });
}

export function packageRemove(alias: string, kind: PackageKind): Promise<void> {
    return invoke("package_remove", { alias, kind });
}

export function wallyInstall(): Promise<ShellRun> {
    return invoke("wally_install");
}

export function wallyUpdate(): Promise<ShellRun> {
    return invoke("wally_update");
}
