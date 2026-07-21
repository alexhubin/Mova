.PHONY: generate test test-web build-web

generate:
	docker run --rm -v "$(PWD):/src" -w /src sqlc/sqlc:1.29.0 generate

test:
	docker compose run --rm backend-test

test-web:
	npm --prefix frontend test

build-web:
	npm --prefix frontend run build
