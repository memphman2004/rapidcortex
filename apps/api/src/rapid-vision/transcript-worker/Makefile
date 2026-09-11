# Build amazon-transcribe + aiohttp against Amazon Linux (Lambda Python 3.11).
# Native wheels must not be compiled on macOS. Docker is required.
#
# SAM: Metadata.BuildMethod=makefile, BuildTarget=build-python-worker
# This is the per-function equivalent of `sam build --use-container` for this worker only.

PYTHON_IMAGE ?= public.ecr.aws/sam/build-python3.11:latest
# Colima/Docker Desktop often cannot bind-mount /Volumes (USB). Stage sources onto $HOME.
DOCKER_SRC := $(CURDIR)
ifneq ($(findstring /Volumes,$(CURDIR)),)
DOCKER_SRC := $(HOME)/.rapid-cortex-sam-build/transcript-worker-src
endif

.PHONY: build-python-worker build-VisionTranscriptWorkerFunction

build-python-worker:
	mkdir -p "$(ARTIFACTS_DIR)"
	if ! command -v docker >/dev/null 2>&1; then \
	  echo "ERROR: docker is required to build the Rapid Vision transcript worker (amazon-transcribe native deps vs Amazon Linux)." >&2; \
	  exit 1; \
	fi
	if [ "$(DOCKER_SRC)" != "$(CURDIR)" ]; then \
	  mkdir -p "$(DOCKER_SRC)"; \
	  cp "$(CURDIR)/requirements.txt" "$(CURDIR)/lambda_function.py" "$(DOCKER_SRC)/"; \
	fi
	docker run --rm --platform linux/amd64 \
	  -v "$(DOCKER_SRC)":/src \
	  -v "$(ARTIFACTS_DIR)":/out \
	  "$(PYTHON_IMAGE)" \
	  /bin/bash -c "pip install --no-cache-dir -r /src/requirements.txt -t /out && cp /src/lambda_function.py /out/"

build-VisionTranscriptWorkerFunction: build-python-worker
