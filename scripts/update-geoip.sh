#!/usr/bin/env bash
set -euo pipefail

# Build-time only. No request path fetches geolocation data.
base="https://github.com/sapics/ip-location-db/releases/download"
output="geoip"
mkdir -p "$output"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT

for family in ipv4 ipv6; do
  asset="dbip-city-${family}-num.gz"
  curl --fail --location --silent --show-error --retry 3 \
    "${base}/latest/${asset}" -o "$temp/$asset"

  expected="$(curl --fail --location --silent --show-error --retry 3 \
    "${base}/checksum/${asset}.sha256" | awk 'NR == 1 { print $1 }')"
  if [[ ! "$expected" =~ ^[[:xdigit:]]{64}$ ]]; then
    echo "Invalid upstream SHA-256 for $asset" >&2
    exit 1
  fi
  printf '%s  %s\n' "$expected" "$temp/$asset" | sha256sum --check --status

  version="${family#ipv}"
  bun scripts/compile-geoip.mjs "$temp/$asset" "$temp/dbip-city-${family}.bin" "$version"
done

# Only publish a consistent IPv4+IPv6 pair, after both have been validated.
mv "$temp/dbip-city-ipv4.bin" "$output/dbip-city-ipv4.bin"
mv "$temp/dbip-city-ipv6.bin" "$output/dbip-city-ipv6.bin"
echo "Geolocation indexes ready"
