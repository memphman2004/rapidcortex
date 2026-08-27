build-NodeDepsLayer:
	mkdir -p "$(ARTIFACTS_DIR)/nodejs/node_modules"
	_src="$${SAM_NODE_MODULES_SRC:-../node_modules}"; \
	if [ ! -d "$${_src}" ]; then \
	  echo "ERROR: NodeDepsLayer missing $$_src — set SAM_NODE_MODULES_SRC to apps/api/node_modules" >&2; \
	  exit 1; \
	fi; \
	if [ -n "$${SAM_NODE_MODULES_HARDLINK}" ]; then \
	  COPYFILE_DISABLE=1 cp -al "$${_src}/." "$(ARTIFACTS_DIR)/nodejs/node_modules/"; \
	else \
	  COPYFILE_DISABLE=1 rsync -a "$${_src}/" "$(ARTIFACTS_DIR)/nodejs/node_modules/"; \
	fi
