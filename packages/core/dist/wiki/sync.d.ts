import { type CompiledWikiVault, type WikiVaultFile } from "./compiler.js";
export interface WikiVaultSyncOptions {
    rootDir: string;
    dryRun?: boolean;
    conflictPolicy?: "skip" | "write_conflict_note";
}
export interface WikiVaultSyncAction {
    path: string;
    action: "write" | "skip_unchanged" | "skip_reviewed" | "write_conflict_note";
    kind: WikiVaultFile["kind"] | "conflict_note";
    conflictPath?: string;
}
export interface WikiVaultSyncReport {
    ok: boolean;
    dryRun: boolean;
    rootDir: string;
    actions: WikiVaultSyncAction[];
}
export declare function syncCompiledWikiVault(vault: CompiledWikiVault, options: WikiVaultSyncOptions): Promise<WikiVaultSyncReport>;
//# sourceMappingURL=sync.d.ts.map