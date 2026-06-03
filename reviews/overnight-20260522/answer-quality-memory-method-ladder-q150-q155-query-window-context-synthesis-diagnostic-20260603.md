# Answer-quality context synthesis diagnostic

Status: READY_FOR_CONTEXT_SYNTHESIS_FIX_LOOP
Methods: session-v1 vs contextual-source-chunk-v1 (bm25-lite)
Retrieval hit-rate lift: 0.2
Answer-quality delta: 0

## Conversion
- Baseline hit-to-correct rate: 0.333333
- Challenger hit-to-correct rate: 0.25
- Challenger-only hits converted: 0/1
- Both-hit but both wrong: 2/3

## Failure Classes
- challenger-retrieved-support-but-answer-still-failed: 1
- converted-to-correct: 1
- retrieval-absence: 1
- retrieved-support-not-converted: 1
- same-failed-answer-despite-retrieved-support: 1

## Repeated Wrong Answer Hashes
- sha256:b23a6a8439c0dde5515893e7c90c1e3233b8616e634470f20dc4928bcf3609bc: 5
- sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b: 2

## Blockers
- none

## Next Actions
- Run a bounded fix loop on answer prompt packaging and context selection for the challenger-only-hit query before a larger scorer run.
- Prioritize support conversion: retrieved expected support should produce a non-unknown candidate answer and a positive judge score.
- After a concrete context/synthesis change, rerun the same q150-q155 method ladder and result gate; do not claim method promotion from retrieval lift alone.
