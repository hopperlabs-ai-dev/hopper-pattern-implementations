# Hopper Pattern Implementations engineering policy

## Authority

This repository owns runnable reproductions, POCs, reference implementations,
diagrams, simulations, fixtures, and conformance receipts for subjects curated
by an external pattern library. It does not own source admission, generalized
pattern claims, or adoption decisions.

## Boundaries

- Every implementation binds an immutable subject identifier and release commit.
- A reproduction states what is faithful, inferred, and intentionally omitted.
- A simulation is always labeled; it must never masquerade as the real system.
- Demo execution is loopback-only, network-denied by design, bounded, and fixture-driven.
- No sibling checkout is required to install, run, or qualify this repository.
- Do not store credentials, private corpora, copyrighted source text, or ambient paths.
- Generated release indexes and receipts are projections, not hand-edited authority.

## Verification

Run `npm run qualify` before publication.
