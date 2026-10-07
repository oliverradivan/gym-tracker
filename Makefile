.PHONY: export-requirements

export-requirements:
	uv export --project back --locked --no-dev --format requirements-txt --output-file requirements.txt
