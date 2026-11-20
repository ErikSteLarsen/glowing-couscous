#!/usr/bin/env bash
set -euo pipefail

desktop_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source_image=${1:-"$desktop_dir/dist/Tempo-Ride-Linux.AppImage"}
app_image="$HOME/Applications/Tempo-Ride.AppImage"
data_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}
applications="$data_dir/applications"
icons="$data_dir/icons/hicolor/512x512/apps"
mime_type=x-scheme-handler/tempo-ride

for command in update-desktop-database xdg-mime; do
  if ! command -v "$command" >/dev/null; then
    printf 'Required command missing: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f "$source_image" ]]; then
  printf 'AppImage missing: %s\nPass a downloaded AppImage or run pnpm dist:linux first.\n' "$source_image" >&2
  exit 1
fi

mkdir -p -- "$HOME/Applications" "$applications" "$icons"
if [[ "$source_image" -ef "$app_image" ]]; then
  chmod 0755 -- "$app_image"
else
  install -m 0755 -- "$source_image" "$app_image"
fi
install -m 0644 -- "$desktop_dir/build/icons/512x512.png" "$icons/tempo-ride.png"

# Exec arguments use desktop string escaping, followed by quoted argument escaping.
exec_path=$(printf '%s' "$app_image" | sed 's/[\\]/\\\\\\\\/g; s/["`$]/\\\\&/g; s/%/%%/g')
cat > "$applications/tempo-ride.desktop" <<ENTRY
[Desktop Entry]
Type=Application
Name=Tempo Ride
Comment=Desktop companion for Tempo indoor bike workouts
Exec="$exec_path" %u
Icon=tempo-ride
Terminal=false
StartupWMClass=tempo-ride
Categories=Sports;
MimeType=$mime_type;
ENTRY

update-desktop-database "$applications"
xdg-mime default tempo-ride.desktop "$mime_type"
if [[ $(xdg-mime query default "$mime_type") != tempo-ride.desktop ]]; then
  printf 'Installed the AppImage, but the default protocol handler could not be confirmed.\n' >&2
  exit 1
fi

printf 'Installed %s\nRegistered %s with tempo-ride.desktop\n' "$app_image" "$mime_type"
