#!/usr/bin/env bash
# Serialize mutations to apps/api vendor-packs + package.json (web zip vs SAM lean deploy).
set -euo pipefail

# When this file is *sourced*, $1 is the caller's arg (e.g. "prod" from
# package-web-source.sh) — never treat that as a lock path. Only honor $1 when
# this script is executed directly.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  RC_API_VENDOR_LOCK="${RC_API_VENDOR_LOCK:-${1:-/tmp/rapid-cortex-api-vendor.lock}}"
else
  RC_API_VENDOR_LOCK="${RC_API_VENDOR_LOCK:-/tmp/rapid-cortex-api-vendor.lock}"
fi

_rc_has_flock() {
  command -v flock >/dev/null 2>&1
}

_rc_has_perl_flock() {
  command -v perl >/dev/null 2>&1
}

# Exclusive lock on fd 9 (blocking). Holds until the shell releases fd 9.
_rc_flock_exclusive() {
  if _rc_has_flock; then
    flock -x 9
  elif _rc_has_perl_flock; then
    perl -MFcntl=:flock -e 'open(my $f, ">>&=", 9) or die $!; flock($f, 2) or die "flock exclusive failed";'
  else
    echo "WARN: flock unavailable (install util-linux or use Linux); api vendor lock skipped" >&2
  fi
}

# Wait until lock is free, then release immediately (readiness gate before packaging).
_rc_flock_wait_then_release() {
  if _rc_has_flock; then
    flock 9
    flock -u 9
  elif _rc_has_perl_flock; then
    perl -MFcntl=:flock -e 'open(my $f, ">>&=", 9) or die $!; flock($f, 2); flock($f, 8);'
  else
    echo "WARN: flock unavailable; skipped api vendor lock wait" >&2
  fi
}

rc_acquire_api_vendor_lock() {
  exec 9>"${RC_API_VENDOR_LOCK}"
  if ! _rc_flock_exclusive; then
    echo "ERROR: could not acquire api vendor lock (${RC_API_VENDOR_LOCK})" >&2
    exit 1
  fi
}

rc_wait_for_api_vendor_lock() {
  exec 9>"${RC_API_VENDOR_LOCK}"
  echo "Waiting for api vendor lock (${RC_API_VENDOR_LOCK})…" >&2
  _rc_flock_wait_then_release
}
