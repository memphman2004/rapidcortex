# SAM4_LEAN_BUILD / SAM_LEAN_BUILD: skip per-function node_modules (deps via NodeDepsLayer).
# Otherwise rsync from SAM_NODE_MODULES_SRC (frozen snapshot) or ./node_modules.
# Parallel rsync of a live apps/api/node_modules tree races (ENOENT / make Error 23).
.PHONY: build-function
build-function:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	if [ -d assets ]; then COPYFILE_DISABLE=1 cp -R assets "$(ARTIFACTS_DIR)/"; fi
	if [ -z "$${SAM4_LEAN_BUILD}$${SAM_LEAN_BUILD}" ]; then \
	  _src="$${SAM_NODE_MODULES_SRC:-node_modules}"; \
	  COPYFILE_DISABLE=1 rsync -a "$${_src}/" "$(ARTIFACTS_DIR)/node_modules/"; \
	fi

.DEFAULT:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	if [ -d assets ]; then COPYFILE_DISABLE=1 cp -R assets "$(ARTIFACTS_DIR)/"; fi
	if [ -z "$${SAM4_LEAN_BUILD}$${SAM_LEAN_BUILD}" ]; then \
	  _src="$${SAM_NODE_MODULES_SRC:-node_modules}"; \
	  COPYFILE_DISABLE=1 rsync -a "$${_src}/" "$(ARTIFACTS_DIR)/node_modules/"; \
	fi
