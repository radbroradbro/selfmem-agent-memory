# Visual Guide

This guide shows the shape of RecallWeave without exposing any memory content.

## Native Memory Flow

```mermaid
flowchart TD
  A["Agent runtime"] --> B["RecallWeave adapter"]
  B --> C["Resolve agent identity"]
  C --> D["Load local container map"]
  D --> E["Recall before useful prompt"]
  E --> F["Inject bounded context"]
  F --> G["Agent response"]
  G --> H["Redact and distill"]
  H --> I["Deduplicate"]
  I --> J["Write local memory"]
  J --> K["Append lifecycle trace"]
```

## Hybrid Search Flow

```mermaid
flowchart TD
  A["User prompt"] --> B["Recall gate"]
  B --> C["Local semantic search"]
  B --> D["Local lexical search"]
  B --> E["Hosted Supermemory read-through"]
  B --> F["Export-cache read-through"]
  C --> G["Candidate merge"]
  D --> G
  E --> G
  F --> G
  G --> H["Dedupe"]
  H --> I["Rerank or score"]
  I --> J["Token-budget compiler"]
  J --> K["Context packet"]
```

## Update Flow

```mermaid
flowchart TD
  A["Pull latest code"] --> B["Run updater dry-run"]
  B --> C["Review planned copies and backups"]
  C --> D["Apply update"]
  D --> E["Run canary smoke"]
  E --> F["Check trace"]
  F --> G["Open issue or PR if anything fails"]
```

## Brain UI Direction

The Brain UI starts with fixture-safe views and a gated read-only selected
container audit:

```mermaid
flowchart LR
  A["Local container"] --> B["Memory counts"]
  A --> C["Duplicate clusters"]
  A --> D["Lifecycle health"]
  A --> E["Read-only audit preview"]
  A --> F["Wiki graph"]
  E --> G["Redacted path label"]
  E --> H["Counts and health reasons"]
  F --> I["Obsidian optional"]
  F --> J["Self-hosted browser UI"]
```

The UI should never upload memory content by default.
