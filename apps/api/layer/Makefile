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
	fi; \
	# Drop toolchain / test-only packages so Layer+fat-function stays under Lambda's 250MB unzipped limit.
	# CFN can attach a new LayerVersion before function CodeUri updates; ~19KB over that ceiling fails the deploy.
	# Keep @swc/helpers — fontkit (via pdfkit) requires it at runtime. Drop other @swc packages.
	rm -rf "$(ARTIFACTS_DIR)/nodejs/node_modules/typescript" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/@types" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/@swc/core" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/@swc/counter" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/@swc/types" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/vitest" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/@vitest" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/eslint" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/@eslint" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/prettier" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/ts-node" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/tsx" \
	  "$(ARTIFACTS_DIR)/nodejs/node_modules/esbuild"; \
	# CLI shims break zip after prune (dangling .bin/tsc → typescript).
	rm -rf "$(ARTIFACTS_DIR)/nodejs/node_modules/.bin"; \
	# Strip sources/maps/docs/tests — @aws-sdk ships .ts alongside .js and blows past the 250MB unzipped layer limit.
	find "$(ARTIFACTS_DIR)/nodejs/node_modules" \( \
	  -name '*.ts' -o -name '*.mts' -o -name '*.cts' -o -name '*.map' -o -name '*.md' -o -name '*.markdown' \
	  -o -name 'LICENSE*' -o -name 'CHANGELOG*' -o -name 'README*' \
	\) -type f -delete 2>/dev/null || true; \
	find "$(ARTIFACTS_DIR)/nodejs/node_modules" \( \
	  -type d \( -name test -o -name tests -o -name __tests__ -o -name docs -o -name examples -o -name .github \) \
	\) -prune -exec rm -rf {} + 2>/dev/null || true; \
	find "$(ARTIFACTS_DIR)/nodejs/node_modules" -type l ! -exec test -e {} \; -delete 2>/dev/null || true
