FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG BARK_VERSION

RUN curl -fsSL "https://gitlab.com/ark-bitcoin/bark/-/releases/bark-${BARK_VERSION}/downloads/barkd-${BARK_VERSION}-linux-x86_64" -o barkd \
    && chmod +x barkd

COPY docker/barkd-entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 4000

CMD ["./entrypoint.sh"]
