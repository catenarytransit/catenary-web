FROM debian:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip git bash && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /frontend
COPY . .

RUN /root/.bun/bin/bun install

# Increment on each CI image build even if the source files are unchanged.
ARG GEOIP_REFRESH=local
RUN echo "GeoIP refresh: $GEOIP_REFRESH" && \
    /root/.bun/bin/bun run build

# This image is served behind Cloudflare Tunnel. Do not expose an origin
# configured to trust CF-Connecting-IP to direct, untrusted HTTP traffic.
ENV ADDRESS_HEADER=CF-Connecting-IP
ENV HOST=0.0.0.0
ENV PORT=4173
EXPOSE 4173

CMD ["/root/.bun/bin/bun", "build/index.js"]
