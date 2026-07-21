.PHONY: generate test test-web build-web

generate:
	docker run --rm -v "$(PWD):/src" -w /src sqlc/sqlc:1.29.0 generate

test:
	go test ./cmd/... ./internal/...

test-web:
	npm --prefix frontend test

build-web:
	npm --prefix frontend run build

