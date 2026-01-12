FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG BARK_VERSION

RUN curl -fsSL "https://gitlab.com/ark-bitcoin/bark/-/releases/bark-${BARK_VERSION}/downloads/bark-${BARK_VERSION}-linux-x86_64" -o bark \
    && chmod +x bark

CMD ["tail", "-f", "/dev/null"]
