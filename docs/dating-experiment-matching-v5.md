# Dating Experiment reciprocal matching V5

Status: implemented code path for a future explicitly versioned round or event. The active Boston V1 experiment remains on its accepted `dating-experiment-two-pair-v4` rules; sealed choices are never rescored in place.

## Product objective

The system should maximize useful reciprocal choices, not one-sided compatibility scores. Every candidate must first pass the participant's explicit reciprocal gender, age, location, and shared-time filters. A known hard dealbreaker excludes the edge. Among eligible edges, V5 ranks the pair on a small, auditable foundation:

- Values alignment: 40%
- Attachment / connection-style compatibility: 35%
- Shared interests: 25%

The score never uses names, photos, race, gender, messages, or inferred attraction. No exact shared-interest overlap is neutral rather than an automatic rejection because free-text vocabularies are sparse. Questionnaire intent and broader profile signals remain context for explanations and offline evaluation but do not affect V5 ranking until enough evidence supports them.

After at least three explicit positive choices, a participant's directed score may receive a 5% reranking adjustment toward the same auditable foundation found in those positive choices. One choice cannot stereotype the person, and a pass is not treated as a negative label because its reason is unknown. Two directed utilities are combined with a harmonic mean so one weak side cannot be hidden by one strong side.

## Shortlist construction

V4 prioritized scarce candidates before relationship quality. V5 first chooses the strongest disjoint reciprocal edges, then uses second-option capacity to cover people who would otherwise receive nothing, and finally fills remaining second slots by quality. The two-option cap is identical for every gender and orientation.

This follows the reciprocal-recommendation principle that both sides' utility and limited attention must be optimized together, while preserving broad access. It does not promise attraction or a response.

## Live diagnostic that informed V5

The aggregate audit at approximately 4:45 PM ET on August 19 contained 53 sealed participant decisions (21 yes, 32 pass). The original score separated yes from pass by 0.7 points with an aggregate pairwise AUC of 0.571. The exact implemented V5 scorer separated them by 3.4 points with AUC 0.656. Its pairwise AUC improved on the original in both observed rounds (0.621 versus 0.596 in round one; 0.738 versus 0.524 in round two). In round two it ranked the chosen person first for all three participants who had two options and chose exactly one.

This sample is too small to claim a production-grade learned model. The audit is evidence for a safer heuristic and instrumentation plan, not proof of chemistry. Re-run `npm run audit:experiment-model` as decisions accumulate. Do not publish person-level output.

## Research basis

- Reciprocal recommenders should model both parties' preferences, not a one-sided rank: Pizzato et al., *RECON: A Reciprocal Recommender for Online Dating* (2013), https://doi.org/10.1007/s11257-012-9125-0
- Reciprocal systems need holistic metrics such as successful matching count, coverage, stability, and balanced ranking rather than only one-sided NDCG: Yang et al., *Revisiting Reciprocal Recommender Systems* (KDD 2024), https://arxiv.org/abs/2408.09748
- Joint ranking in matching markets should account for reciprocal utility and limited attention: Su et al., *Optimizing Rankings for Recommendation in Matching Markets* (WWW 2022), https://www.cs.cornell.edu/people/tj/publications/su_etal_22a
- Mutual-response outcomes and user/profile context are the relevant target, not a generic similarity number: Xia et al., *Who Proposes to Whom?* (ICWSM 2014), https://ojs.aaai.org/index.php/ICWSM/article/view/14516

## Next measurement loop

Track exposure, option position, score version/components, sealed yes/pass, favorite, mutual yes, attendance, and post-date feedback. Add an optional structured pass reason in a future consented flow (`not my type`, `different intent`, `distance`, `profile too thin`, `timing`, `other`) rather than guessing why a participant passed. Evaluate ranking by round and hold out future rounds; do not tune and grade on the same tiny sample.
