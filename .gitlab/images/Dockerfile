FROM docker.io/ubuntu:25.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        podman \
        buildah \
        gnupg2 \
        qemu-user-static \
        binfmt-support \
        passt \
        && rm -rf /var/lib/apt/lists/*

COPY wakemeops.gpg /etc/apt/trusted.gpg.d/
RUN cat /etc/apt/trusted.gpg.d/wakemeops.gpg | gpg --dearmor > /etc/apt/trusted.gpg.d/wakemeops-keyring.gpg && \
        echo "deb [signed-by=/etc/apt/trusted.gpg.d/wakemeops-keyring.gpg] http://deb.wakemeops.com/wakemeops stable dev devops" > /etc/apt/sources.list.d/wakemeops.list && \
        apt-get update && \
        apt-get install -y --no-install-recommends glab && \
        rm -rf /var/lib/apt/lists/*

RUN mkdir -p ~/.config/containers && \
        echo '{"default":[{"type":"insecureAcceptAnything"}],"transports":{"docker":{"":[{"type":"insecureAcceptAnything"}]},"docker-archive":{"":[{"type":"insecureAcceptAnything"}]}}}' > ~/.config/containers/policy.json
RUN mkdir -p /etc/containers && printf '%s\n' \
        '[storage]' \
        'driver = "vfs"' \
        'runroot = "/run/containers/storage"' \
        'graphroot = "/var/lib/containers/storage"' \
        > /etc/containers/storage.conf


RUN mkdir -p /root/.config/containers
COPY registry-auth.json /root/.config/containers/auth.json
RUN buildah login --authfile /root/.config/containers/auth.json registry.2nd.dev
RUN buildah login --authfile /root/.config/containers/auth.json docker.io
