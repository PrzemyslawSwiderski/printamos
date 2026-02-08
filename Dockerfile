FROM eclipse-temurin:25.0.2_10-jre-alpine-3.22

# Install runtime packages and tini (small init)
RUN apk add --no-cache \
    avahi \
    avahi-tools \
    cups \
    cups-filters \
    brlaser \
    epson-inkjet-printer-escpr \
    dbus \
    ipptool \
    tini \
    && mkdir -p /var/run/cups /var/spool/cups /var/log/cups /app

WORKDIR /app

# Copy jar and config files
COPY build/libs/printamos-all.jar /app/server.jar
COPY docker/conf/cupsd.conf /etc/cups/cupsd.conf
COPY docker/conf/cups-browsed.conf /etc/cups/cups-browsed.conf
COPY docker/conf/avahi-daemon.conf /etc/avahi/avahi-daemon.conf

# Copy entrypoint script and make executable
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Default user is root; no USER directive needed

# Expose relevant ports
# Printamos Web UI
EXPOSE 8080
# CUPS Admin
EXPOSE 631

ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]
