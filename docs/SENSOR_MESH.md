# Earth 2036 — Non-Gating Sensor Mesh

## Purpose

Earth 2036 cannot predict every shock. It can improve the odds of seeing pressure build before consensus does.

The sensor mesh broadens observation without weakening or bloating the hard publication/tick gate. Sensors are early-warning inputs. They are not canonical truth and are not counted in active gating source coverage.

`lib/discovery-sources.ts` is the registry. Sources with `coverageRole: "sensor"` are explicitly excluded from `gatingDiscoverySources`.

## Sensor contract

A sensor may:

- surface a company, technology, resource, regulation, bottleneck, vulnerability or regime shift for investigation;
- create a weak-signal candidate or peer research request;
- increase research priority when independent signals converge;
- expose a missing node or dependency in the causal graph.

A sensor may not by itself:

- clear an active gating source family;
- move an Earth Score, official rank or active-universe boundary;
- convert a weak signal into Iron/Gold/Diamond evidence;
- turn missing data into a negative fact;
- make `discoveryScanCompleted=true` merely because the sensor endpoint was reachable.

Before canonical influence, the underlying event must be normalized/deduplicated, entity identity resolved, materiality established and the factual claim verified through the best available primary/corroborating source.

Sensor outage is recorded as an observation blind spot but does not automatically block a tick. If the unavailable sensor is the only known way to resolve a material question, that question remains unknown and can still block through the normal evidence/council path.

## Initial official sensor families

- FederalRegister.gov API — proposed/final rules, notices and public-inspection documents; legally material conclusions should be verified against the official rule/agency source.
- Bureau of Industry and Security EAR / Entity List — export controls and end-user/end-use restrictions.
- Treasury OFAC Sanctions List Service — sanctions entities/program changes.
- NIH RePORTER — biomedical research funding and emerging research directions.
- NSF Awards API — early funded science/engineering capabilities.
- CISA Known Exploited Vulnerabilities — real-world cyber exploitation and vendor pressure.
- NHTSA datasets/APIs — safety defects, complaints, recalls and vehicle/autonomy signals.
- FAA Commercial Space Transportation — launch/reentry licenses, permits and approvals.
- EPA ECHO web services — facility/environmental compliance and industrial constraints.
- DOJ Antitrust case filings — competition/merger intervention.
- FTC cases and proceedings — competition, privacy and consumer-protection actions.
- BEA API — industry output, input-output dependencies, regional investment and macro regime shifts.

## Predict-the-unpredictable loop

The Discovery/Weak-Signals lane asks every cycle:

> What important 2036 dependency has no source, metric, company or graph node?

It also looks for:

- multiple independent weak signals converging on one direction;
- constraint migration: what becomes scarce after today's bottleneck is solved;
- narrative-versus-operational divergence;
- cross-domain shock propagation;
- unusual disappearances or silence in previously stable disclosures;
- new regulation or government funding that changes incentives before revenue appears;
- new failure modes that the current causal graph cannot explain.

If a new data family repeatedly provides unique, decision-relevant information, Earth may propose promoting it from sensor to a stronger coverage role. That is an accuracy-first methodology decision and must be explicit; it is never promoted merely because more sources look impressive.
