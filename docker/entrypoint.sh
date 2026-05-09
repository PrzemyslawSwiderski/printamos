#!/bin/sh

# Start dbus
echo "Starting dbus-daemon..."
mkdir -p /run/dbus
dbus-daemon --system > /var/log/cups/dbus 2>&1 &

sleep 2

# Overwrite Docker's generated file with our own
cat <<EOF > /etc/resolv.conf
nameserver 127.0.0.1
options ndots:0
EOF

# Start unbound
echo "Starting unbound..."
unbound 2>&1 &

sleep 2

# Start avahi2dns
echo "Starting avahi2dns..."
avahi2dns -v -p 5354 > /var/log/avahi2dns 2>&1 &

sleep 2

# Start avahi-daemon
echo "Starting avahi-daemon..."
avahi-daemon --no-drop-root --no-rlimits --debug > /var/log/cups/avahi 2>&1 &

# Start cupsd if available
if command -v cupsd >/dev/null 2>&1; then
  echo "Starting cupsd..."
  # Start cupsd and allow it to daemonize; fail the container if it cannot start.
  if ! cupsd >/dev/null 2>&1; then
    echo "Failed to start cupsd" >&2
    exit 1
  fi
fi

# Wait a moment, then start cups-browsed
sleep 2

# Start cups-browsed in background
echo "Starting cups-browsed..."
cups-browsed --logfile &
# Or just cups-browsed & to run in background without debug

# Finally, exec Java process, replacing the shell to allow signal propagation
exec java --enable-native-access=ALL-UNNAMED -jar /app/server.jar
