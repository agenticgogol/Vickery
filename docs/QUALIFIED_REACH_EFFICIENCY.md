# Qualified Reach Efficiency

## Purpose

This is a deterministic planning estimate of relevant audience exposure per rupee spent. It is not audited reach, a guaranteed delivery measure, causal incrementality, or an auction-clearing input.

## Formula

`Estimated Qualified Impressions = Slot Traffic × Visibility Factor × Audience Match × Ad Share × Context Factor`

`Qualified Reach Efficiency = Estimated Qualified Impressions / Expected Cost × 1,000`

`Estimated Qualified CPM = Expected Cost / Estimated Qualified Impressions × 1,000`

## Inputs and defaults

- **Slot Traffic:** estimated daily traffic apportioned to the slot duration and structured time-of-day multiplier.
- **Visibility:** Premium 0.90; Standard 0.70. An explicit input can override these defaults.
- **Audience Match:** 0.90 for all selected target tags matched, 0.70 for a partial match or no targeting brief, 0.40 for a weak/missing match.
- **Ad Share:** 0.10 by default, representing an equal share of a ten-ad loop.
- **Context:** 1.00 without a reliable campaign timing preference; 1.05 when the slot matches it and 0.90 otherwise.
- **Expected Cost:** clearing price when known; otherwise the displayed reserve or entered planned bid, labelled accordingly.

## Multi-slot campaigns

The campaign view reports gross qualified impressions separately from adjusted estimated reach. It applies a simple 8% overlap discount for each additional screen, capped at 25%. This is a transparent planning assumption, not a deduplicated unique-reach model.

## Confidence

- **High:** traffic, audience target, visibility, and ad-share inputs are explicitly present.
- **Medium:** traffic and billboard audience exist but one or more factors use defaults.
- **Low:** traffic or audience data is missing; the estimator falls back conservatively and never invents traffic.

## Limitations and future use

The metric is based only on supplied inventory metadata and campaign preferences. It is not audited or guaranteed impressions. Its reusable output fields (`estimatedQualifiedImpressions`, `qualifiedReachEfficiency`, and `estimatedQualifiedCpm`) can later inform a deterministic autobid policy, subject to explicit advertiser caps and approval.
