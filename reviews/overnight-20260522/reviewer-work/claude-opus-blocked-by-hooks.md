# Claude Opus Reviewer Route Blocked

Date: 2026-05-23

## What Was Tried

Claude CLI is installed and available. The reviewer route used noninteractive
print mode, disabled session persistence, bypassed permissions, and gave Claude
a small reviewer budget.

## What Happened

Claude did not return reviewer JSON. Even a tiny sanity prompt triggered local
project hooks before Claude could answer. The hook chain launched the local
goal-loop review workflow, so the reviewer process hung instead of producing the
one JSON object required by the baseline approval gate.

## Status

Claude Opus is blocked for this gate. It does not count as an approval.

## Smallest Safe Follow-Up

Use a hookless authenticated Claude route for this one reviewer job, or
temporarily disable the project hook that launches goal-loop review before
rerunning the metrics-only reviewer prompt. The output must still be a single
JSON approval artifact, and it must pass `baseline:reviewer-intake` before it
counts.

