# Combined Answer-Quality Memory Score

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Scored query count: 30
- Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c
- Query-set hash: sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7

## Winner
- cloud-nvidia-nemotron-1b: answerQuality=43.1667, correctRate=0.4333

## Arms
- bm25-lite: answerQuality=20, correctRate=0.2
- cloud-nvidia-nemotron-1b: answerQuality=43.1667, correctRate=0.4333
- full-hybrid-rerank: answerQuality=26.6667, correctRate=0.2667
- local-apple-qwen3-0_6b: answerQuality=26.6667, correctRate=0.2667
- local-apple-qwen3-0_6b-local-rerank: answerQuality=36, correctRate=0.3667
- query-expanded-full-hybrid-rerank: answerQuality=20, correctRate=0.2

## Inputs
- reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json (sha256:023efc5150655fce79e997428fa79cef202aed9516d4f8cfd336eb63d6e0f472)
- reviews/overnight-20260522/end-to-end-memory-score-live-provider-20260525.json (sha256:182681f12644f886d37e8edfa6a020bf902abefa88677d74c221a74e5f9413dc)

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
