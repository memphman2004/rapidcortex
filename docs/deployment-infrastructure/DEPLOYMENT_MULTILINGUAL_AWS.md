# AWS deployment: multilingual voice secrets & configuration

This document covers **Secrets Manager**, **SAM (`infra/template.yaml`)**, **Lambda env**, **IAM**, **fail-fast validation**, and **rollout** for the multilingual pipeline. It does not replace provider-specific setup in [LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md).

## Secret naming (canonical)

| Logical secret | Secrets Manager **Name** (managed mode) | Contents |
| --- | --- | --- |
| Azure Speech + Translator | `rapidcortex/<DeploymentStage>/multilingual/azure-api` | JSON: `AZURE_SPEECH_KEY`, `AZURE_TRANSLATION_KEY` (see `runtimeSecrets` key extraction). |
| Google service account | `rapidcortex/<DeploymentStage>/multilingual/google-service-account` | **Full** GCP service account JSON (replace entire value after deploy). |

`<DeploymentStage>` is the SAM parameter `DeploymentStage` (`dev` | `staging` | `prod`).

**External mode:** create secrets yourself (any region in the stack account) and pass ARNs via parameters `AzureSpeechKeySecretArn`, `AzureTranslationKeySecretArn`, `GoogleApplicationCredentialsSecretArn`. For **scoped** IAM (`MultilingualSecretsPolicyMode=scoped`, default), secret **names** should begin with `rapidcortex/<stage>/multilingual` so their ARNs match the policy resource pattern `...:secret:rapidcortex/<stage>/multilingual*`. If you cannot rename secrets, set **`MultilingualSecretsPolicyMode=broad`** (legacy `secret:*` behavior for those two Lambdas only).

## SAM parameters

| Parameter | Default | Purpose |
| --- | --- | --- |
| `DeploymentStage` | `dev` | Baked into secret **Names** and IAM scope. |
| `MultilingualSecretProvisioning` | `external` | `managed`: stack creates the two secrets above (placeholders). `external`: only use ARN parameters. |
| `MultilingualSecretsPolicyMode` | `scoped` | `scoped`: `GetSecretValue` limited to `rapidcortex/<stage>/multilingual*` in this account/region. `broad`: all secrets in account/region. |
| `AzureSpeechKeySecretArn` | `""` | External Azure speech/primary key secret (JSON or plain string per `runtimeSecrets`). |
| `AzureTranslationKeySecretArn` | `""` | External Azure Translator key (optional; can match speech secret). |
| `GoogleApplicationCredentialsSecretArn` | `""` | External Google SA JSON secret. |

## Lambda environment (wired by SAM)

- **Globals:** `MULTILINGUAL_STRICT_VALIDATION` from `Mappings` (`false` in **dev**, `true` in **staging**, **pilot**, and **prod**). Override per function in the console if needed.
- **Globals (voice + AI, stage-aware):** `Mappings.ApiLambdaDefaults` sets multilingual vendor tiers and AI providers by **`DeploymentStage`**:
  - **`dev`:** mock/mock/off chains (no external keys required).
  - **`staging` / `pilot` / `prod`:** STT chain **Azure → Google → Amazon Transcribe** (tertiary), with Comprehend/Translate for LID/translation tiers as mapped, and **`PRIMARY_PROVIDER=bedrock`** for incident analysis. Requires **IAM** (Transcribe, Translate, Comprehend, Bedrock, S3 on `ASSETS_BUCKET`) plus secrets for Azure and Google. Transcribe-specific tuning: [AWS_TRANSCRIBE_CONFIGURATION.md](./AWS_TRANSCRIBE_CONFIGURATION.md). Override **`Mappings.ApiLambdaDefaults`** or Lambda env if your agency stack differs.
- **`PostIncidentAudioChunkFunction`** and **`AddTranscriptChunkFunction`:**
  - `AZURE_SPEECH_KEY_SECRET_ARN` → managed secret ref **or** parameter.
  - `AZURE_TRANSLATION_KEY_SECRET_ARN` → same managed Azure secret in managed mode **or** parameter.
  - `GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN` → managed Google secret **or** parameter.

## IAM

For the two multilingual Lambdas, `secretsmanager:GetSecretValue` is allowed on:

- **Scoped:** `arn:aws:secretsmanager:<region>:<account>:secret:rapidcortex/<DeploymentStage>/multilingual*`
- **Broad:** `arn:aws:secretsmanager:<region>:<account>:secret:*`

Other functions that call AI providers may still use broader secret access where already defined in the template.

## Fail-fast validation

When **`MULTILINGUAL_STRICT_VALIDATION`** is `true` (staging/prod by default):

- `postIncidentAudioChunk`, `addTranscriptChunk`, **`startLanguageSession`**, **`finalizeLanguageSession`**, and **`getLanguageSessionStatus`** call `validateMultilingualDeploymentConfig()` (via `getMultilingualConfigBlockResponse()`) before business logic where applicable.
- If any non-mock multilingual tier is selected but required credentials are missing, the API returns **503** with `{ code: "MULTILINGUAL_CONFIG_INVALID", issues: [...] }`.

Set **`MULTILINGUAL_STRICT_VALIDATION=false`** on those Lambdas in dev accounts that intentionally run **mock** providers only.

## Deployment steps

1. **Choose mode**
   - **Managed:** `sam deploy --parameter-overrides MultilingualSecretProvisioning=managed DeploymentStage=prod ...`
   - **External:** create secrets in Secrets Manager; copy ARNs; `MultilingualSecretProvisioning=external` (default) and pass `AzureSpeechKeySecretArn`, etc.

2. **Replace placeholder secret values (managed only)**  
   After first successful deploy, run `aws secretsmanager put-secret-value` (or Console) for each stack output secret so keys are real. Until then, strict validation may pass only if providers are still **mock**; real Azure/Google calls will fail at runtime.

3. **Set provider env** (same Lambda or SSM/Parameter Store pattern your org uses) for `PRIMARY_STT_PROVIDER`, `PRIMARY_TRANSLATION_PROVIDER`, etc., per [LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md).

4. **Redeploy** after changing secrets so new Lambda environments pick up env (or wait for natural recycle).

5. **Smoke test**
   - `POST .../language-session/start`
   - `POST .../audio-chunks` with a tiny mock chunk (or real audio in staging).

## Validation checklist

- [ ] `DeploymentStage` matches the environment you think you deployed.
- [ ] If **scoped** IAM: all secret **names** used by ARNs start with `rapidcortex/<stage>/multilingual`, **or** `MultilingualSecretsPolicyMode=broad`.
- [ ] Managed outputs **MultilingualAzureApiSecretArn** / **MultilingualGoogleServiceAccountSecretArn** show in stack Outputs when `MultilingualSecretProvisioning=managed`.
- [ ] Secret payloads: Azure JSON keys present; Google value is valid single JSON object with `client_email` and `private_key`.
- [ ] Lambdas have `MULTILINGUAL_STRICT_VALIDATION` as intended for that account.
- [ ] With real providers enabled, `POST .../audio-chunks` does **not** return `MULTILINGUAL_CONFIG_INVALID`.
- [ ] CloudWatch: no repeated `AccessDeniedException` on `secretsmanager:GetSecretValue`.

## Outputs

When `MultilingualSecretProvisioning=managed`, the stack exports:

- `MultilingualAzureApiSecretArn`
- `MultilingualGoogleServiceAccountSecretArn`

Use these in runbooks or CI to target `put-secret-value`.
