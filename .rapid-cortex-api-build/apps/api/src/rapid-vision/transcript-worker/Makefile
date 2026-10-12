# Build amazon-transcribe + aiohttp against Amazon Linux (Lambda Python 3.11).
# Native wheels must not be compiled on macOS.
#
# Default: source-only zip (no Docker). Live KVS transcribe stays on VISION_TRANSCRIPT_MOCK
# until a later docker-built worker. Opt in with VISION_DOCKER_BUILD=1.
#
# SAM: Metadata.BuildMethod=makefile, BuildTarget=build-python-worker
# This is the per-function equivalent of `sam build --use-container` for this worker only.

PYTHON_IMAGE ?= public.ecr.aws/sam/build-python3.11:latest
VISION_DOCKER_BUILD ?= 0
# Colima/Docker Desktop cannot bind-mount /Volumes (USB) or SAM /var/folders temps.
# deploy.sh may redirect HOME onto /Volumes (SAM_CLI_HOME) — never stage there.
# Prefer SAM_BUILD_DIR (internal drive), else real macOS home under /Users.
_STAGE_ROOT := $(SAM_BUILD_DIR)
ifeq ($(_STAGE_ROOT),)
_STAGE_ROOT := $(HOME)/.rapid-cortex-sam-build
endif
ifneq ($(findstring /Volumes,$(_STAGE_ROOT)),)
_STAGE_ROOT := /Users/$(shell id -un)/.rapid-cortex-sam-build
endif
DOCKER_SRC := $(CURDIR)
ifneq ($(findstring /Volumes,$(CURDIR)),)
DOCKER_SRC := $(_STAGE_ROOT)/transcript-worker-src
endif
ifneq ($(findstring /var/folders,$(CURDIR)),)
DOCKER_SRC := $(_STAGE_ROOT)/transcript-worker-src
endif
ifneq ($(findstring /tmp/,$(CURDIR)),)
DOCKER_SRC := $(_STAGE_ROOT)/transcript-worker-src
endif

.PHONY: build-python-worker build-VisionTranscriptWorkerFunction

build-python-worker:
	mkdir -p "$(ARTIFACTS_DIR)"
ifneq ($(VISION_DOCKER_BUILD),1)
	@echo "VISION_DOCKER_BUILD!=1: packaging transcript worker source only (no amazon-transcribe wheels)"
	cp "$(CURDIR)/lambda_function.py" "$(ARTIFACTS_DIR)/"
	cp "$(CURDIR)/requirements.txt" "$(ARTIFACTS_DIR)/"
else
	if ! command -v docker >/dev/null 2>&1; then \
	  echo "ERROR: docker is required when VISION_DOCKER_BUILD=1 (amazon-transcribe native deps vs Amazon Linux)." >&2; \
	  exit 1; \
	fi
	mkdir -p "$(DOCKER_SRC)"; \
	cp "$(CURDIR)/requirements.txt" "$(CURDIR)/lambda_function.py" "$(DOCKER_SRC)/"; \
	docker run --rm --platform linux/amd64 \
	  -v "$(DOCKER_SRC)":/src \
	  -v "$(ARTIFACTS_DIR)":/out \
	  "$(PYTHON_IMAGE)" \
	  /bin/bash -c "pip install --no-cache-dir -r /src/requirements.txt -t /out && cp /src/lambda_function.py /out/"
endif

build-VisionTranscriptWorkerFunction: build-python-worker
