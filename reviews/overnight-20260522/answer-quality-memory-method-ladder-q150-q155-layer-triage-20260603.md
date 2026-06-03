# q150-q155 Layer Triage

Status: `BLOCKED_FOR_METHOD_PROMOTION_BUT_READY_FOR_CONTEXT_SYNTHESIS_LOOP`

This slice now has a real layer diagnosis, not just another benchmark row.

- Retrieval support improved: contextual chunks hit expected support on 4/5 queries versus 3/5 for the session baseline.
- Answer-quality did not improve: direct DeepSeek Flash scored both `session-v1` and `contextual-source-chunk-v1` at 20.
- The method result gate still blocks promotion because the challenger did not beat the session baseline.

## Evidence

- Answer-quality ladder: `reviews/overnight-20260522/answer-quality-memory-method-ladder-q150-q155-direct-deepseek-flash-20260603.json`
- Result gate: `reviews/overnight-20260522/answer-quality-memory-method-ladder-q150-q155-method-result-gate-20260603.json`
- Retrieval autopsy: `reviews/overnight-20260522/answer-quality-memory-method-ladder-q150-q155-retrieval-autopsy-20260603.json`

## Conclusion

Do not spend the next loop expanding BM25-only control scoring. The useful signal is that retrieval moved, but answer synthesis did not convert the extra support into a better judged answer.

The next bounded loop should target context selection and answer synthesis for the one challenger-only-hit query and the one both-miss query, then rerun the same q150-q155 answer-quality gate.

Secret/private-path concern here is limited to checked-in or release-facing artifacts. Local memory contents are not the defect being measured.
