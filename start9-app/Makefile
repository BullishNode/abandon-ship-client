PKG_ID = bark-web
PKG_VERSION = 0.2.3

# Default platform — override on `make` line for cross-builds.
PLATFORM ?= linux/amd64

S9PK = $(PKG_ID).s9pk

.PHONY: all clean verify pack docker-amd64 docker-arm64 docker-images

all: $(S9PK)

# Build context = repo root (..). Dockerfile lives at start9-app/Dockerfile.
# All make targets run with cwd=start9-app/, so paths are relative to that.

docker-amd64:
	mkdir -p docker-images
	docker buildx build \
	  --platform linux/amd64 \
	  --tag start9/$(PKG_ID)/main:$(PKG_VERSION) \
	  --file Dockerfile \
	  --output type=docker,dest=docker-images/x86_64.tar \
	  ..

docker-arm64:
	mkdir -p docker-images
	docker buildx build \
	  --platform linux/arm64 \
	  --tag start9/$(PKG_ID)/main:$(PKG_VERSION) \
	  --file Dockerfile \
	  --output type=docker,dest=docker-images/aarch64.tar \
	  ..

docker-images: docker-amd64 docker-arm64

pack: docker-images manifest.yaml instructions.md icon.png LICENSE
	start-sdk pack

verify:
	start-sdk verify s9pk $(S9PK)

$(S9PK): pack
	$(MAKE) verify

clean:
	rm -f $(S9PK)
	rm -rf docker-images
