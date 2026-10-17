# Phoenix P7B — Reproduce archived SEC source review

The source archive is a 243,735,107-byte GitHub Release asset, tagged `fundamentals-cache-20261017T050818Z-39004369528`. Its expected SHA-256 is `6379596d013d554ca20264b5c3806bd528837934eeed492c6fff51f5705a5ae2`.

This session verified GitHub Release **metadata** against the committed bridge health; it **could not fetch the binary**. This command is therefore a reproducible *operator-side* pilot, **not a claim that original bytes were verified**.

From a checked-out branch containing this script, download the exact release artifact using your existing authenticated GitHub CLI:

```bash
gh release download fundamentals-cache-20261017T050818Z-39004369528 --repo JILLOnline/Earth-2036 --pattern bridge-cache.tar.gz --dir /tmp/phoenix-p7b
node scripts/phoenix-archive-pilot.mjs /tmp/phoenix-p7b/bridge-cache.tar.gz
```

The script hashes the entire compressed archive against the committed health report, locates the two per-CIK source entries, reads each raw payload, checks CIK identity, and counts date-filtered Company Facts for AEVA and SWKS as a **noncanonical diagnostic**. This does **not** prove SEC acceptance timestamps or historical public availability: the SEC Company Facts `filed` field alone is inadequate for that proof. The pilot intentionally admits **zero** historic T0 facts, has no GitHub/source writes, does not score, and cannot restart workers.

Even a successful archive read cannot be treated as historical source attestation; separately acquire and verify original filing accessions/acceptance/publication and amendments to the exact `2026-09-12T23:59:59-04:00` cutoff. Do not run this as a scheduled source worker.
