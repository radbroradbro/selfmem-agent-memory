import { type NucleusIndexSnapshot } from "../nucleus/index.js";
export interface WikiVaultCompileOptions {
    vaultRoot?: string;
    includeNucleusJson?: boolean;
    includeManifest?: boolean;
}
export interface WikiVaultFile {
    path: string;
    contents: string;
    kind: "wiki_page" | "index" | "log" | "methodology" | "manifest" | "nucleus";
    nodeId?: string;
}
export interface WikiVaultManifest {
    schemaVersion: 1;
    generatedAt: string;
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
    files: Array<{
        path: string;
        kind: WikiVaultFile["kind"];
        nodeId?: string;
    }>;
}
export interface CompiledWikiVault {
    snapshot: NucleusIndexSnapshot;
    manifest: WikiVaultManifest;
    files: WikiVaultFile[];
}
export interface WikiVaultLintIssue {
    code: "missing_frontmatter" | "broken_wikilink" | "duplicate_path" | "unsafe_path";
    path: string;
    message: string;
}
export declare function compileNucleusWikiVault(snapshot: NucleusIndexSnapshot, options?: WikiVaultCompileOptions): CompiledWikiVault;
export declare function lintCompiledWikiVault(vault: CompiledWikiVault): WikiVaultLintIssue[];
//# sourceMappingURL=compiler.d.ts.map