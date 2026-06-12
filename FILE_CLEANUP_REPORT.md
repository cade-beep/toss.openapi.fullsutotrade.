# FILE_CLEANUP_REPORT.md

This report reviews redundant and historical analysis documents in the repository, evaluating them against source code dependencies, documentation value, and duplication rules.

---

## 1. Candidate File Evaluation Registry

| Filename | Purpose | Referenced in Code? | Duplicate of another file? | Deletion Confidence | Reason | Classification |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `PR13A_VERIFICATION_REPORT.md` | Verification scores of original logic | NO | NO | 100% | Historical validation metrics. | **ARCHIVE** |
| `PR13B_EVIDENCE_MATRIX.md` | Code-line by code-line proof matrix | NO | NO | 100% | Historical audit data. | **ARCHIVE** |
| `PR13C_SOURCE_VALIDATION.md` | Rewrite source validation metrics | NO | NO | 100% | Historical validation metrics. | **ARCHIVE** |
| `PR13D_LIVE_ENDPOINT_VALIDATION.md` | Complete OpenAPI specification parameters | NO | NO | 100% | Contains unique spec contracts. Required for implementation. | **KEEP** |
| `PR13E_IMPLEMENTATION_SCOPE.md` | Modified files change-list scope | NO | NO | 100% | Historical scope baseline. | **ARCHIVE** |
| `PR13F_IMPLEMENTATION_GATE.md` | Rollback and test strategies per change | NO | NO | 100% | Historical strategy gate details. | **ARCHIVE** |
| `PR13G_REAL_API_PROOF_REQUIREMENTS.md` | Expected request/response payload designs | NO | NO | 100% | Historical design specs. | **ARCHIVE** |
| `PR13H_PROOF_GAP_ANALYSIS.md` | Sandbox vs production validation analysis | NO | NO | 100% | Historical gap analysis. | **ARCHIVE** |
| `PR13I_EVIDENCE_CONFIDENCE_MATRIX.md` | Spec evaluation confidence matrices | NO | YES | 100% | Superseded by PR13N (Runtime Confidence Matrix). | **DELETE** |
| `PR13J_PRE_IMPLEMENTATION_APPROVAL.md` | Final statuses check before write approval | NO | NO | 100% | Historical audit check. | **ARCHIVE** |
| `PR13K_REAL_API_EVIDENCE_COLLECTION_PLAN.md` | Plan to execute raw error queries | NO | NO | 100% | Historical query design. | **ARCHIVE** |
| `PR13L_AUTHENTICATED_EVIDENCE_REQUIREMENTS.md` | Assumed response schemas for 200 OK | NO | NO | 100% | Referenced for auth payload mapping. | **KEEP** |
| `PR13M_ASSUMPTION_AUDIT.md` | Audits assumptions vs OpenAPI spec | NO | NO | 100% | Critical mapping of execution and client ID omissions. | **KEEP** |
| `PR13N_RUNTIME_CONFIDENCE_MATRIX.md` | Spec/runtime confidence comparison matrix | NO | NO | 100% | Required reference for build readiness assessment. | **KEEP** |
| `PR13O_RUNTIME_RISK_REGISTER.md` | Categorizes type, parser, and breaking risks | NO | NO | 100% | Required for input validation and fault-tolerant designs. | **KEEP** |
| `PR13P_ORDER_STATE_RISK_AUDIT.md` | Audits order states and ledger updates | NO | NO | 100% | Required reference for persistence state changes. | **KEEP** |
| `PR13Q_STATE_MACHINE_CONFIDENCE_AUDIT.md` | State transition confidence ratings | NO | YES | 100% | Superseded by PR13R. | **DELETE** |
| `PR13R_TRANSITION_EVIDENCE_GAP.md` | Defines test cases for sandbox state testing | NO | NO | 100% | Active reference for sandbox test planning. | **KEEP** |
| `PR13_REWRITE_PLAN.md` | Phases and sequencing timeline for rewrite | NO | NO | 100% | Project guide for rewrite development steps. | **KEEP** |
| `TOSS_API_COMPLIANCE_EVIDENCE.md` | Compliance baseline analysis report | NO | YES | 100% | Superseded by PR13D and PR13E. | **DELETE** |
| `REAL_API_EVIDENCE_LOG.md` | Raw error payload values from live gateway | NO | NO | 100% | Live rate limit and header reference source. | **KEEP** |
| `architecture_plan.md` | Original architecture framework outline | NO | NO | 100% | Historical blueprint. | **ARCHIVE** |
| `architecture_readiness_review.md` | Original code design validation | NO | NO | 100% | Historical design review. | **ARCHIVE** |
| `broker_order_mapping_architecture.md` | Reconciler locking sequence specs | NO | NO | 100% | Contains unique db lock sequences. Required. | **KEEP** |
| `development_roadmap.md` | Initial development milestones | NO | NO | 100% | Historical roadmap. | **ARCHIVE** |
| `implementation_roadmap_v1.md` | Phase 1 milestone timelines | NO | NO | 100% | Historical timeline. | **ARCHIVE** |
| `infrastructure_and_concurrency_remediation_plan.md` | Initial concurrency plans | NO | NO | 100% | Historical concurrency plans. | **ARCHIVE** |
| `toss_adapter_skeleton_architecture.md` | Original skeleton proposal blueprint | NO | NO | 100% | Historical blueprint. | **ARCHIVE** |

---

## 2. List of Files Proposed for ARCHIVE

These files contain historical designs or timelines which are not required for implementation or runtime, and will be compressed/moved to a dedicated `./archive/` folder once approved:

1. `PR13A_VERIFICATION_REPORT.md`
2. `PR13B_EVIDENCE_MATRIX.md`
3. `PR13C_SOURCE_VALIDATION.md`
4. `PR13E_IMPLEMENTATION_SCOPE.md`
5. `PR13F_IMPLEMENTATION_GATE.md`
6. `PR13G_REAL_API_PROOF_REQUIREMENTS.md`
7. `PR13H_PROOF_GAP_ANALYSIS.md`
8. `PR13J_PRE_IMPLEMENTATION_APPROVAL.md`
9. `PR13K_REAL_API_EVIDENCE_COLLECTION_PLAN.md`
10. `architecture_plan.md`
11. `architecture_readiness_review.md`
12. `development_roadmap.md`
13. `implementation_roadmap_v1.md`
14. `infrastructure_and_concurrency_remediation_plan.md`
15. `toss_adapter_skeleton_architecture.md`

---

## 3. List of Files Proposed for DELETE

These files are redundant duplicates or fully superseded by newer matrices and will be removed once approved:

1. `PR13I_EVIDENCE_CONFIDENCE_MATRIX.md` (Superseded by PR13N)
2. `PR13Q_STATE_MACHINE_CONFIDENCE_AUDIT.md` (Superseded by PR13R)
3. `TOSS_API_COMPLIANCE_EVIDENCE.md` (Superseded by PR13D and PR13E)
