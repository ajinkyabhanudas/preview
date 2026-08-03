.DEFAULT_GOAL := help
.PHONY: help install lint typecheck test test-property test-leak test-determinism test-links check build clean gates

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

lint: ## Lint source and tests
	npm run lint

typecheck: ## Type-check without emitting
	npm run typecheck

test: ## Run the full test suite with coverage
	npm run test

test-property: ## Property tests on the resolver — the invariant gate (spec/build-v1.md §5.1)
	npm run test:property

test-leak: ## Assert no denylisted term appears in a built bundle (spec/build-v1.md §5.3)
	node scripts/leak-check.mjs

test-determinism: ## Assert two builds of the same fixture are byte-identical (spec/build-v1.md §4)
	node scripts/determinism-check.mjs

test-links: ## Assert every doc link and anchor resolves
	node scripts/link-check.mjs

check: lint typecheck test ## Lint + typecheck + test. Run before every commit.

gates: check test-property test-leak test-determinism test-links ## Every release gate. Must pass before merge.

build: ## Compile TypeScript to dist/
	npm run build

clean: ## Remove build output and caches
	rm -rf dist coverage .vitest node_modules/.cache
