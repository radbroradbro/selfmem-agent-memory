export declare const DEFAULT_LOCAL_CONTAINER_AUDIT_FILES: readonly ["memories.jsonl", "raw_events.jsonl", "lossless_context.jsonl", "trace.jsonl"];
export type LocalContainerAuditFileName = (typeof DEFAULT_LOCAL_CONTAINER_AUDIT_FILES)[number];
export interface LocalContainerAuditInput {
    rootDir: string;
    containerLabel?: string;
    maxFileBytes?: number;
    inspectFiles?: readonly string[];
}
export interface LocalContainerAuditFile {
    name: string;
    exists: boolean;
    bytes?: number;
    lineCount?: number;
    redactionCount?: number;
    skippedReason?: "missing" | "unsafe_name" | "oversize" | "read_error";
}
export interface LocalContainerAuditReport {
    schemaVersion: 1;
    mode: "local-container-audit";
    writesRealFiles: false;
    rootPathRedacted: true;
    containerLabel: string;
    maxFileBytes: number;
    files: LocalContainerAuditFile[];
    totals: {
        existingFiles: number;
        inspectedFiles: number;
        bytes: number;
        lines: number;
        redactionCount: number;
        skippedFiles: number;
    };
    health: {
        status: "healthy" | "needs-review";
        reasons: string[];
    };
}
export declare function auditLocalContainer(input: LocalContainerAuditInput): Promise<LocalContainerAuditReport>;
//# sourceMappingURL=audit.d.ts.map