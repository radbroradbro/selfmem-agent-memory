# Answer-Quality Context Policy Ablation

- Status: READY_FOR_SOURCE_GRANULARITY_FIX_LOOP
- Same raw query selection: true
- Public benchmark claims allowed: false
- Best by answer quality: extractive-window (20)
- Best by collapse reduction: extractive-window (repeated wrong uses=0)

## Variants

- support-aware: answerPrompt=support-aware-v1, contextPackaging=ranked-prefix-v1, challengerAQ=20, delta=0, hitToCorrect=0.25, repeatedWrongUses=8, unknownUses=6, bareOneUses=2
- query-window: answerPrompt=support-aware-v1, contextPackaging=query-overlap-window-v1, challengerAQ=20, delta=0, hitToCorrect=0.25, repeatedWrongUses=7, unknownUses=5, bareOneUses=2
- extractive-window: answerPrompt=extractive-support-v1, contextPackaging=query-overlap-window-v1, challengerAQ=20, delta=0, hitToCorrect=0.25, repeatedWrongUses=0, unknownUses=0, bareOneUses=0

## Conclusion

Prompt and context packaging variants reduced repeated answer collapse, but did not improve answer-quality; the next bounded loop should target source granularity, answer-bearing span coverage, or expected-answer support selection.

## Next Actions

- Do not expand the benchmark or promote the challenger from prompt/context-policy changes alone.
- Add a bounded public-safe source-granularity or answer-bearing-span diagnostic for the same q150-q155 shard.
- Prioritize support selection: the challenger retrieves support but still fails answer-quality conversion.
