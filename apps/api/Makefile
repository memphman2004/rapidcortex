# SAM4_LEAN_BUILD / SAM_LEAN_BUILD: skip per-function node_modules (deps via NodeDepsLayer).
# Otherwise copy from SAM_NODE_MODULES_SRC (frozen snapshot) or ./node_modules.
# SAM_NODE_MODULES_HARDLINK=1 uses cp -al (same filesystem) — far faster than rsync for N functions.
# Parallel rsync of a live apps/api/node_modules tree races (ENOENT / make Error 23).
.PHONY: build-function build-GrantIngestorFunction build-GrantMatcherFunction
build-function:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	if [ -d assets ]; then COPYFILE_DISABLE=1 cp -R assets "$(ARTIFACTS_DIR)/"; fi
	if [ -d src ]; then \
	  find src -name '*.json' | while read -r f; do \
	    rel="$${f#src/}"; \
	    mkdir -p "$(ARTIFACTS_DIR)/dist/$$(dirname "$$rel")"; \
	    COPYFILE_DISABLE=1 cp "$$f" "$(ARTIFACTS_DIR)/dist/$$rel"; \
	  done; \
	fi
	if [ -z "$${SAM4_LEAN_BUILD}$${SAM_LEAN_BUILD}" ]; then \
	  _src="$${SAM_NODE_MODULES_SRC:-node_modules}"; \
	  mkdir -p "$(ARTIFACTS_DIR)/node_modules"; \
	  if [ -n "$${SAM_NODE_MODULES_HARDLINK}" ]; then \
	    COPYFILE_DISABLE=1 cp -al "$${_src}/." "$(ARTIFACTS_DIR)/node_modules/"; \
	  else \
	    COPYFILE_DISABLE=1 rsync -aL "$${_src}/" "$(ARTIFACTS_DIR)/node_modules/"; \
	  fi; \
	fi

# Grant Lambdas import rapid-cortex-shared. Lean builds omit node_modules and
# these functions have no deps layer, so always ship the package and its runtime deps.
build-GrantIngestorFunction build-GrantMatcherFunction:
	$(MAKE) build-function ARTIFACTS_DIR="$(ARTIFACTS_DIR)"
	mkdir -p "$(ARTIFACTS_DIR)/node_modules/@noble"
	rm -rf "$(ARTIFACTS_DIR)/node_modules/rapid-cortex-shared" "$(ARTIFACTS_DIR)/node_modules/zod" "$(ARTIFACTS_DIR)/node_modules/@noble/hashes"
	COPYFILE_DISABLE=1 cp -RL node_modules/rapid-cortex-shared "$(ARTIFACTS_DIR)/node_modules/rapid-cortex-shared"
	COPYFILE_DISABLE=1 cp -RL node_modules/zod "$(ARTIFACTS_DIR)/node_modules/zod"
	COPYFILE_DISABLE=1 cp -RL node_modules/@noble/hashes "$(ARTIFACTS_DIR)/node_modules/@noble/hashes"

.DEFAULT:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	if [ -d assets ]; then COPYFILE_DISABLE=1 cp -R assets "$(ARTIFACTS_DIR)/"; fi
	if [ -d src ]; then \
	  find src -name '*.json' | while read -r f; do \
	    rel="$${f#src/}"; \
	    mkdir -p "$(ARTIFACTS_DIR)/dist/$$(dirname "$$rel")"; \
	    COPYFILE_DISABLE=1 cp "$$f" "$(ARTIFACTS_DIR)/dist/$$rel"; \
	  done; \
	fi
	if [ -z "$${SAM4_LEAN_BUILD}$${SAM_LEAN_BUILD}" ]; then \
	  _src="$${SAM_NODE_MODULES_SRC:-node_modules}"; \
	  mkdir -p "$(ARTIFACTS_DIR)/node_modules"; \
	  if [ -n "$${SAM_NODE_MODULES_HARDLINK}" ]; then \
	    COPYFILE_DISABLE=1 cp -al "$${_src}/." "$(ARTIFACTS_DIR)/node_modules/"; \
	  else \
	    COPYFILE_DISABLE=1 rsync -aL "$${_src}/" "$(ARTIFACTS_DIR)/node_modules/"; \
	  fi; \
	fi
