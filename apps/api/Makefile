# SAM4_LEAN_BUILD / SAM_LEAN_BUILD: skip per-function node_modules (deps via NodeDepsLayer).
# Otherwise copy from SAM_NODE_MODULES_SRC (frozen snapshot) or ./node_modules.
# SAM_NODE_MODULES_HARDLINK=1 uses cp -al (same filesystem) — far faster than rsync for N functions.
# Parallel rsync of a live apps/api/node_modules tree races (ENOENT / make Error 23).
.PHONY: build-function
build-function:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	if [ -d assets ]; then COPYFILE_DISABLE=1 cp -R assets "$(ARTIFACTS_DIR)/"; fi
	if [ -z "$${SAM4_LEAN_BUILD}$${SAM_LEAN_BUILD}" ]; then \
	  _src="$${SAM_NODE_MODULES_SRC:-node_modules}"; \
	  mkdir -p "$(ARTIFACTS_DIR)/node_modules"; \
	  if [ -n "$${SAM_NODE_MODULES_HARDLINK}" ]; then \
	    COPYFILE_DISABLE=1 cp -al "$${_src}/." "$(ARTIFACTS_DIR)/node_modules/"; \
	  else \
	    COPYFILE_DISABLE=1 rsync -a "$${_src}/" "$(ARTIFACTS_DIR)/node_modules/"; \
	  fi; \
	fi

.DEFAULT:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	if [ -d assets ]; then COPYFILE_DISABLE=1 cp -R assets "$(ARTIFACTS_DIR)/"; fi
	if [ -z "$${SAM4_LEAN_BUILD}$${SAM_LEAN_BUILD}" ]; then \
	  _src="$${SAM_NODE_MODULES_SRC:-node_modules}"; \
	  mkdir -p "$(ARTIFACTS_DIR)/node_modules"; \
	  if [ -n "$${SAM_NODE_MODULES_HARDLINK}" ]; then \
	    COPYFILE_DISABLE=1 cp -al "$${_src}/." "$(ARTIFACTS_DIR)/node_modules/"; \
	  else \
	    COPYFILE_DISABLE=1 rsync -a "$${_src}/" "$(ARTIFACTS_DIR)/node_modules/"; \
	  fi; \
	fi
