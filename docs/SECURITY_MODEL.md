# Security Model

RecallWeave separates code, credentials, runtime memory, and diagnostics.

## Code Repository

The public repository should contain:

- adapter source,
- core retrieval and redaction utilities,
- docs,
- tests,
- sanitized fixtures,
- metrics-only benchmark summaries.

The public repository should not contain:

- provider keys,
- raw memories,
- raw transcripts,
- runtime databases,
- personal container mappings,
- private diagnostics,
- exported hosted memory content.

## Runtime Boundary

Credentials stay on the agent machine. The updater accepts a local `keys.env`
path only when the operator passes it explicitly. The repository never provides
a default key file.

## Redaction Boundary

The private-tag rule applies before:

- persistence,
- embedding,
- reranking,
- query expansion,
- hosted read-through caching,
- wiki sync,
- logs,
- benchmark traces.

Fully private candidate writes should be rejected. Malformed private tags should
be handled conservatively by redacting from the opening tag to the nearest close
tag or the end of the text.

## Hosted Read-Through

Supermemory support is read-only by default. Hosted write-back needs a dry-run
sync report that shows:

- no private content,
- no duplicate write storms,
- correct container mapping,
- bounded provider spend,
- clear rollback instructions.

## Diagnostics

Share operational evidence, not memory content. Useful diagnostics include event
counts, provider mode, lifecycle coverage, redaction counts, error classes,
version info, and sanitized stack traces.
