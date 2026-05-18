# Root-level shim. The Start9 submission build pipeline runs `make` at the
# wrapper repo root; delegate to start9-app/ where the real Makefile lives.

.PHONY: all clean verify pack docker-amd64 docker-arm64 docker-images

all:
	$(MAKE) -C start9-app all

clean:
	$(MAKE) -C start9-app clean

verify:
	$(MAKE) -C start9-app verify

pack:
	$(MAKE) -C start9-app pack

docker-amd64:
	$(MAKE) -C start9-app docker-amd64

docker-arm64:
	$(MAKE) -C start9-app docker-arm64

docker-images:
	$(MAKE) -C start9-app docker-images
