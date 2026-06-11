.PHONY: build-function
build-function:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	COPYFILE_DISABLE=1 rsync -a node_modules/ "$(ARTIFACTS_DIR)/node_modules/"

.DEFAULT:
	mkdir -p "$(ARTIFACTS_DIR)"
	COPYFILE_DISABLE=1 cp -R dist package.json "$(ARTIFACTS_DIR)/"
	COPYFILE_DISABLE=1 rsync -a node_modules/ "$(ARTIFACTS_DIR)/node_modules/"
