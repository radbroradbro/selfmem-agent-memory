const keyPatterns = [
    [/pa-[A-Za-z0-9_-]{40,}/g, "[REDACTED_VOYAGE_KEY]"],
    [/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED_GOOGLE_AI_KEY]"],
    [/jina_[0-9A-Za-z_-]{20,}/g, "[REDACTED_JINA_KEY]"],
    [/sk-ant-[A-Za-z0-9_-]{40,}/g, "[REDACTED_ANTHROPIC_KEY]"],
    [/sk-or-v1-[A-Za-z0-9_-]{40,}/g, "[REDACTED_OPENROUTER_KEY]"],
    [/sk-[A-Za-z0-9_-]{32,}/g, "[REDACTED_OPENAI_LIKE_KEY]"],
    [/sm_[A-Za-z0-9_-]{40,}/g, "[REDACTED_SUPERMEMORY_KEY]"],
    [/nvapi-[A-Za-z0-9_-]{32,}/g, "[REDACTED_NVIDIA_KEY]"],
    [/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]"],
    [/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
    [/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g, "[REDACTED_TELEGRAM_BOT_TOKEN]"],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/g, "[REDACTED_SLACK_TOKEN]"],
];
export function redactPrivate(input) {
    let text = redactPrivateTags(input);
    let redactionCount = text.count;
    let output = text.text;
    for (const [pattern, replacement] of keyPatterns) {
        output = output.replace(pattern, () => {
            redactionCount += 1;
            return replacement;
        });
    }
    const visible = output.replace(/\[[A-Z0-9_]+\]/g, "").trim();
    return {
        text: output,
        redacted: redactionCount > 0,
        redactionCount,
        fullyPrivate: visible.length === 0,
    };
}
function redactPrivateTags(input) {
    let count = 0;
    let out = "";
    let index = 0;
    const lower = input.toLowerCase();
    while (index < input.length) {
        const start = lower.indexOf("<private>", index);
        if (start === -1) {
            out += input.slice(index);
            break;
        }
        out += input.slice(index, start);
        const contentStart = start + "<private>".length;
        const end = lower.indexOf("</private>", contentStart);
        const resumeAt = end === -1 ? input.length : end + "</private>".length;
        out += "[REDACTED_PRIVATE]";
        count += 1;
        index = resumeAt;
    }
    return { text: out, count };
}
//# sourceMappingURL=private.js.map