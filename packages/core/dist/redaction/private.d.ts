export interface RedactionResult {
    text: string;
    redacted: boolean;
    redactionCount: number;
    fullyPrivate: boolean;
}
export declare const redactionBoundaryPatterns: RegExp[];
export declare function containsRedactionBoundaryText(input: string): boolean;
export declare function redactPrivate(input: string): RedactionResult;
//# sourceMappingURL=private.d.ts.map