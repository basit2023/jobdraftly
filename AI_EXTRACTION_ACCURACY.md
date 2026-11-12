# AI Extraction Accuracy Report

Date: 11 November 2026

## Result

Actual OCR/AI extraction accuracy: **not measured**.

`AI_EXTRACTION_WEBHOOK_URL` and `AI_EXTRACTION_WEBHOOK_SECRET` are not configured, and the repository does not contain a native OCR or AI model. Reporting a percentage would therefore be misleading.

## Evaluation dataset

The development-only dataset contains eight explicitly non-production cases:

1. English single-vacancy advertisement.
2. Urdu image advertisement.
3. Mixed Urdu and English image.
4. Degraded newspaper-style scan.
5. Two-page PDF.
6. Low-quality blurred image.
7. Advertisement containing multiple vacancies.
8. Deadline-extension corrigendum.

Assets are stored under `tests/fixtures/ai-extraction/`; the multi-page PDF is stored under `output/pdf/`. Every synthetic advert says it is a QA fixture and not a real vacancy.

## Evaluated fields

- Job title
- Department
- Vacancy count
- Education
- Experience
- Age limit
- BPS
- Location
- Domicile
- Quota
- Application deadline
- Application URL

## Validation behavior

The extraction contract now:

- Represents missing and blank values as null.
- Rejects undocumented extra fields.
- Rejects non-HTTP(S) application URLs.
- Supports multiple separate vacancy records.
- Scores unknown-field inventions as hallucinations.

Five automated contract/evaluator tests pass. These prove the evaluation harness and response validation work; they do not prove model accuracy.

## Required real evaluation

After configuring an authorized extraction service:

1. Submit every fixture without modifying its source quality.
2. Save the raw service response and model/service version.
3. Validate each response against the canonical contract.
4. Compare all 12 fields against the expected record.
5. Report per-field accuracy, macro accuracy, failed documents, and hallucination count.
6. Manually review every Urdu, multi-vacancy, low-quality, and corrigendum result.

Recommended release gates:

- Zero invented values where the expected field is null.
- 100% correct application URLs and deadlines on accepted records.
- Separate records for every multi-vacancy advertisement.
- Human review for low-confidence or partially extracted documents.
