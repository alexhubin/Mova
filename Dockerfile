FROM golang:1.26-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/mova-api ./cmd/api

FROM alpine:3.23

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 mova \
    && adduser -S -D -H -u 10001 -G mova mova

COPY --from=build /out/mova-api /usr/local/bin/mova-api
USER mova
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/mova-api"]
