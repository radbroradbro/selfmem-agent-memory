# Combined Answer-Quality Memory Score

- Fixture only: false
- Ready for end-to-end memory score gate: true
- Public benchmark claims allowed: false
- Benchmark: longmemeval
- Combine mode: query-shard-answer-quality-union
- Scored query count: 500
- Query coverage: 0-500 of 500
- Target hash: sha256:dcdd33ca5a4ad3154dc3cf0da74c10fc96a1864e8f8b6ce154aff5386bdfc23e
- Query-set hash: sha256:04e10ea57d93b48fe6a7182b30920fe93676d597b91e19c6f7db4f29cbacfa95

## Winner
- local-apple-qwen3-0_6b-local-rerank: answerQuality=24.9, correctRate=0.242

## Arms
- bm25-lite: answerQuality=22.162, correctRate=0.216
- full-hybrid-rerank: answerQuality=18.532, correctRate=0.18
- local-apple-qwen3-0_6b: answerQuality=20.67, correctRate=0.198
- local-apple-qwen3-0_6b-local-rerank: answerQuality=24.9, correctRate=0.242
- query-expanded-full-hybrid-rerank: answerQuality=18.292, correctRate=0.176

## Inputs
- reviews/overnight-20260522/answer-quality-local-full-shard-001-20260526.json (sha256:6c329ec7c00cc2bff4ad467ff52f39d451bc9aaaf3f822e9ef665e7e13246af1)
- reviews/overnight-20260522/answer-quality-local-full-shard-002-recovery-20260526.json (sha256:2cae108c8d3bee0e77faf7e223449c86fadc066d5a8d54c6d8258a2bb71c7be0)
- reviews/overnight-20260522/answer-quality-local-full-shard-003-20260527.json (sha256:22093f44f751bfe39108a7033359d92432ca0c4f8b5c7feb558c5317e96f1f0d)
- reviews/overnight-20260522/answer-quality-local-full-shard-004-20260527.json (sha256:d759315f4d09b6e0eea6a92afa0fb0108a4c1697abba0fb7bfd7c16709f3d8de)
- reviews/overnight-20260522/answer-quality-local-full-shard-005-common-arm-projection-20260527.json (sha256:ba54e0bc9b075e16ca5f7216af543dada25953ac4f485b27b21bcd9ef6b947fe)
- reviews/overnight-20260522/answer-quality-local-full-shard-006-20260527.json (sha256:97e81b56ca75fff5674beb3fcffac6bdedbb1b0396ad218b6b7167c2a29e3f5a)
- reviews/overnight-20260522/answer-quality-local-full-shard-007-20260527.json (sha256:f2a5567f572fba5779aca33a7ce7776cf87d76de447b5c53029f5a806fa0ef8e)
- reviews/overnight-20260522/answer-quality-local-full-shard-008-20260527.json (sha256:b650a76bfffd524d6b049e825e05719daad4e1ba18b09751aa148553239505e0)
- reviews/overnight-20260522/answer-quality-local-full-shard-009-20260528.json (sha256:1d4f19deecd5eee5579fbe12182e8a155ac6687640a1ff5af17ac2bda5a0e765)
- reviews/overnight-20260522/answer-quality-local-full-shard-010-20260528.json (sha256:a68bef535cca95a086ffe5a1661f6481d9e483f8b02c09632d32b2dc693296ac)
- reviews/overnight-20260522/answer-quality-local-full-shard-011-20260528.json (sha256:8e2348eecf2d6bba8815e734c2bf6a00c34d58b00b63c85889869197717312b1)
- reviews/overnight-20260522/answer-quality-local-full-shard-012-20260528.json (sha256:50417192ab845cdf041c5881c9209ea287a757a9de5951beeb62a25bda712276)
- reviews/overnight-20260522/answer-quality-local-full-shard-013-20260528.json (sha256:7b5c793200b66fb45aa2161f132a1d1895ba567620bbd1f02651469b4278ec8f)
- reviews/overnight-20260522/answer-quality-local-full-shard-014-20260528.json (sha256:91527b6777ba83b9d48335a4d5c0491c07c0d7f0e112f415dffb5db5bbb14b35)
- reviews/overnight-20260522/answer-quality-local-full-shard-015-20260529.json (sha256:220d56608eea13cfcc0a940531429f9c78885038cd0b808c7d371c5a52541a62)
- reviews/overnight-20260522/answer-quality-local-full-shard-016-20260529.json (sha256:4e7115bee6ba8eb2c84da5080ab29489be305ff93fe7d6656b092d3a21d0a7c0)
- reviews/overnight-20260522/answer-quality-local-full-shard-017-cpu-recovery-20260529.json (sha256:5e9b4de54c44d42886ffc4338d6f31e768acb59b9ba5c4d63a611bfa0b2f3f03)
- reviews/overnight-20260522/answer-quality-local-full-shard-018-20260529.json (sha256:b3f799c59ac0dc19dfabc53dbbde169b9f6b29ea170ca23503513f2e268a65a9)
- reviews/overnight-20260522/answer-quality-local-full-shard-019-20260529.json (sha256:ede48f8d19e05ca035fedeed8e1b9b66b367591bfa17bee0c9fdb84de9202973)
- reviews/overnight-20260522/answer-quality-local-full-shard-020-20260529.json (sha256:39fd75be55d9f7bc8920e14394f1dc669584edadc54fd2c7e81d3d60a3fb5694)

## Safety
- Metrics only: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
