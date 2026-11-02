# iQ Vision Training Pipeline — Known Gaps

The mock-mode search ran before this pipeline was added. Hits below stay as they are.

## Mock search

| Pattern | Where | Decision |
|---|---|---|
| `NOT_CONNECTED` | `apps/web/lib/rapid-vision/model-studio.ts` clip extraction | Left in place. A training clip is still not cut from a video file. |
| `NOT_STARTED` | `startTrainingJob` in `model-studio.ts` | Left as the web gate. The Training Jobs button sends `datasetReady: false`, and the route passes `backendConnected: false`. This action does not call `create_project_version`. |
| `VISION_TRANSCRIPT_MOCK` | transcript worker, `stack-app-sam-6.yaml`, `apps/api/src/lib/env.ts` | Left on. Live transcript stays mocked until a browser smoke test passes. This training code does not change that flag. |
| `TRAINING_MOCK` | no matches | Nothing to flip. |

`startTrainingJob` still returns no job id when the gate is open. The launcher that would call Rekognition lives in `src/training_job_launcher/launcher.py` and is unit-tested with a fake client. It was not invoked against account 158961537080.

## Class map

The unlock note lists `nexcort-tactical-vest` and `nexcort-bladed-weapon`. The studio does not use those names. Manifests use the labels already on review records:

- `firearm_like` → `handgun_visible` (class id 0)
- `blade_like` → `knife_visible` (class id 1)
- `altercation` → `physical_fight`
- `person_down` → `person_fallen`
- `forced_entry` → `nexcort-forced-entry`
- `vehicle_collision` → `vehicle_collision`

A synthetic-only set must cover firearm-like and blade-like with 3 camera angles and 3 lighting conditions each. Verified rows still have to reach 50, with both positives and lookalikes, before the readiness function reports ready. No Custom Labels job is started from the web action.

## Not deployed

No stack was deployed. The parent stack `rapid-cortex-dev` was not edited. Bucket names in the unlock note (`nexcortiq-vision-studio`, `nexcortiq-vision-first-party`) were not created. Studio images stay in `rapid-cortex-vision-artifacts-dev-158961537080`. The AWS profile for this account is `rapid-cortex`, not `nexcortiq-prod`.

## Video frame extraction

The first-party importer accepts still images. Video files are not extracted to frames.

## Rekognition Custom Labels activation

A `TRAINED` version is not started with `start_project_version`. Live detection stays on DetectLabels.

## First-party upload

Presigned upload code requires an active data-sharing agreement for the same agency. No upload route was added to the web app, and no raw object was written.
