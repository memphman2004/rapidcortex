.PHONY: build-function
build-function:
	mkdir -p "$(ARTIFACTS_DIR)"
	cp -r handler.mjs node_modules package.json package-lock.json "$(ARTIFACTS_DIR)/"

.PHONY: build-CognitoPostConfirmationFunction
build-CognitoPostConfirmationFunction: build-function
