#!/usr/bin/env bash
# Builds the Linux AppImage and .deb. electron-builder's bundled fpm needs
# libcrypt.so.1, which some distros (e.g. Arch) don't ship by default, so a
# system fpm (`gem install --user-install fpm erb`) is used when available.
set -euo pipefail
if [ -z "${USE_SYSTEM_FPM:-}" ]; then
  gem_bin="$(ruby -e 'print Gem.user_dir' 2>/dev/null)/bin"
  [ -x "$gem_bin/fpm" ] && export PATH="$gem_bin:$PATH"
  command -v fpm >/dev/null 2>&1 && export USE_SYSTEM_FPM=true
fi
exec electron-builder --linux --publish never "$@"
