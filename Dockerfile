FROM eclipse-temurin:25.0.3_9-jre-alpine-3.22

RUN apk add --no-cache \
      avahi \
      avahi-tools \
      openresolv \
      unbound \
      cups \
      cups-filters \
      brlaser \
      epson-inkjet-printer-escpr \
      dbus \
      ipptool \
      tini \
      libreoffice \
      gcompat \
      && mkdir -p /var/run/cups /var/spool/cups /var/log/cups /app

ADD https://github.com/LouisBrunner/avahi2dns/releases/download/0.2.0/avahi2dns-linux-amd64 /usr/local/bin/avahi2dns
RUN chmod +x /usr/local/bin/avahi2dns

WORKDIR /app

# Copy jar and config files
COPY build/libs/printamos-all.jar /app/server.jar
COPY docker/conf/cupsd.conf /etc/cups/cupsd.conf
COPY docker/conf/cups-browsed.conf /etc/cups/cups-browsed.conf
COPY docker/conf/avahi-daemon.conf /etc/avahi/avahi-daemon.conf
COPY docker/conf/avahi-local.conf /etc/unbound/unbound.conf.d/avahi-local.conf

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
