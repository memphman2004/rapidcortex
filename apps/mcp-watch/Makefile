# SAM Makefile build for McpWatchFunction (BuildMethod: makefile)
# Bundles a single CommonJS artifact; AWS SDK v3 stays external (Lambda runtime).
# rapid-cortex-shared is vendored at vendor/rapid-cortex-shared (copied with CodeUri).

.PHONY: build-McpWatchFunction

build-McpWatchFunction:
	@test -n "$(ARTIFACTS_DIR)" || (echo "ARTIFACTS_DIR required" >&2; exit 1)
	mkdir -p "$(ARTIFACTS_DIR)"
	@test -d "$(CURDIR)/vendor/rapid-cortex-shared/dist" || (echo "ERROR: vendor/rapid-cortex-shared/dist missing — sync shared dist before sam build" >&2; exit 1)
	cd "$(CURDIR)" && npm install --omit=dev --no-workspaces --no-audit --no-fund
	cd "$(CURDIR)" && npx --yes esbuild src/lambda.ts \
	  --bundle \
	  --platform=node \
	  --target=node22 \
	  --format=cjs \
	  --outfile="$(ARTIFACTS_DIR)/lambda.js" \
	  --external:@aws-sdk/* \
	  --external:aws-sdk
	printf '%s\n' '{"type":"commonjs"}' > "$(ARTIFACTS_DIR)/package.json"
