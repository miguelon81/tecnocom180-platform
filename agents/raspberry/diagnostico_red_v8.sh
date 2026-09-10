#!/bin/bash

# ============================================================
# TECNOCOM180 - DIAGNOSTICS ENGINE
# V8.2 CENTRAL
# ============================================================

VERSION="8.2"
PING_COUNT=5
PING_TIMEOUT=1

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS_COUNT=0
WARNING_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ============================================================
# STRUCTURED RESULTS
# ============================================================

INTERNET_DEV=""
INTERNET_SRC=""
INTERNET_GW=""

PRIMARY_PACKET_LOSS=""
PRIMARY_PING_MS=""

DNS_SERVERS=""
DNS_OK=false
INTERNET_OK=false

# ============================================================
# SPEEDTEST RESULTS
# ============================================================

SPEEDTEST_ETH_OK=false
SPEEDTEST_WIFI_OK=false

ETH_DOWNLOAD_MBPS=""
ETH_UPLOAD_MBPS=""
ETH_LATENCY_MS=""
ETH_JITTER_MS=""
ETH_PACKET_LOSS=""

WIFI_DOWNLOAD_MBPS=""
WIFI_UPLOAD_MBPS=""
WIFI_LATENCY_MS=""
WIFI_JITTER_MS=""
WIFI_PACKET_LOSS=""

ETH_SPEEDTEST_SERVER=""
WIFI_SPEEDTEST_SERVER=""

print_header() {
    echo
    echo "============================================================"
    echo " TECNOCOM180 DIAGNOSTICS ENGINE"
    echo " V$VERSION - CENTRAL"
    echo "============================================================"
    date
    echo
}

pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    WARNING_COUNT=$((WARNING_COUNT + 1))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

skip() {
    echo "[SKIP] $1"
    SKIP_COUNT=$((SKIP_COUNT + 1))
}

# ============================================================
# SYSTEM
# ============================================================

test_system() {

    echo
    echo "---------------- SYSTEM ----------------"

    HOSTNAME=$(hostname)
    OS=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2- | tr -d '"')
    UPTIME=$(uptime -p 2>/dev/null)

    echo "Hostname : $HOSTNAME"
    echo "OS       : $OS"
    echo "Uptime   : $UPTIME"

    pass "Sistema identificado"
}

# ============================================================
# INTERFACES
# ============================================================

test_interfaces() {

    echo
    echo "---------------- INTERFACES ----------------"

    ip -br addr

    echo

    for IFACE_PATH in /sys/class/net/*; do

        IFACE=$(basename "$IFACE_PATH")

        case "$IFACE" in
            lo|tailscale0)
                continue
                ;;
        esac

        STATE=$(cat "/sys/class/net/$IFACE/operstate" 2>/dev/null)

        if [ "$STATE" = "up" ]; then
            pass "$IFACE está UP"
        else
            warning "$IFACE está ${STATE:-UNKNOWN}"
        fi

    done
}

# ============================================================
# LINK
# ============================================================

test_link() {

    echo
    echo "---------------- LINK ----------------"

    if command -v ethtool >/dev/null 2>&1; then

        if [ -d /sys/class/net/eth0 ]; then

            SPEED=$(ethtool eth0 2>/dev/null | awk -F': ' '/Speed:/ {print $2}')
            DUPLEX=$(ethtool eth0 2>/dev/null | awk -F': ' '/Duplex:/ {print $2}')
            AUTONEG=$(ethtool eth0 2>/dev/null | awk -F': ' '/Auto-negotiation:/ {print $2}')
            LINK=$(ethtool eth0 2>/dev/null | awk -F': ' '/Link detected:/ {print $2}')

            echo "eth0"
            echo "Speed            : ${SPEED:-N/A}"
            echo "Duplex           : ${DUPLEX:-N/A}"
            echo "Auto-negotiation : ${AUTONEG:-N/A}"
            echo "Link detected    : ${LINK:-N/A}"

            if [ "$LINK" = "yes" ] && [ "$DUPLEX" = "Full" ]; then
                if [ "$SPEED" = "1000Mb/s" ]; then
                    pass "eth0 enlace 1 Gbps Full Duplex"
                else
                    pass "eth0 enlace activo Full Duplex ($SPEED)"
                fi
            elif [ "$LINK" = "yes" ]; then
                warning "eth0 enlace activo pero revisar dúplex"
            else
                fail "eth0 sin enlace físico"
            fi

        else
            skip "eth0 no existe"
        fi

    else
        skip "ethtool no está instalado"
    fi
}

# ============================================================
# NETWORK MANAGER
# ============================================================

test_network_manager() {

    echo
    echo "---------------- NETWORK MANAGER ----------------"

    if ! command -v nmcli >/dev/null 2>&1; then
        skip "nmcli no disponible"
        return
    fi

    NM_VERSION=$(nmcli --version 2>/dev/null | head -n1)

    echo "Manager : ${NM_VERSION:-NetworkManager}"

    for IFACE in eth0 wlan0; do

        if ! nmcli device status 2>/dev/null | awk -v d="$IFACE" '$1==d {found=1} END {exit !found}'; then
            skip "$IFACE no administrada por NetworkManager"
            continue
        fi

        STATE=$(nmcli -t -f GENERAL.STATE device show "$IFACE" 2>/dev/null | cut -d: -f2-)
        CONNECTION=$(nmcli -t -f GENERAL.CONNECTION device show "$IFACE" 2>/dev/null | cut -d: -f2-)

        echo
        echo "Interface  : $IFACE"
        echo "State      : ${STATE:-N/A}"
        echo "Connection : ${CONNECTION:-N/A}"

        if [[ "$STATE" == 100* ]]; then
            pass "$IFACE administrada y conectada por NetworkManager"
        else
            warning "$IFACE no aparece como conectada por NetworkManager"
        fi

    done
}

# ============================================================
# ROUTING
# ============================================================

test_routing() {

    echo
    echo "---------------- ROUTING ----------------"

    ip route

    echo

    DEFAULT=$(ip route show default | head -n1)

    if [ -n "$DEFAULT" ]; then
        echo "Ruta principal:"
        echo "$DEFAULT"
        pass "Ruta por defecto detectada"
    else
        fail "No existe ruta por defecto"
    fi
}

# ============================================================
# INTERNET ROUTE
# ============================================================

test_internet_route() {

    echo
    echo "---------------- INTERNET ROUTE ----------------"

    ROUTE=$(ip route get 8.8.8.8 2>/dev/null)

    if [ -z "$ROUTE" ]; then
        fail "No se pudo determinar ruta a Internet"
        return
    fi

    echo "$ROUTE"

    DEV=$(echo "$ROUTE" | grep -oP 'dev \K\S+' | head -n1)
    SRC=$(echo "$ROUTE" | grep -oP 'src \K\S+' | head -n1)
    GW=$(echo "$ROUTE" | grep -oP 'via \K\S+' | head -n1)

    INTERNET_DEV="$DEV"
    INTERNET_SRC="$SRC"
    INTERNET_GW="$GW"

    echo
    echo "Internet vía : $DEV"
    echo "IP origen    : $SRC"
    echo "Gateway      : ${GW:-directo}"

    pass "Ruta a Internet disponible"
}

# ============================================================
# GATEWAYS
# ============================================================

test_gateways() {

    echo
    echo "---------------- GATEWAYS ----------------"

    DEFAULTS=$(ip route show default)

    if [ -z "$DEFAULTS" ]; then
        fail "No se encontraron gateways"
        return
    fi

    while read -r LINE; do

        [ -z "$LINE" ] && continue

        GW=$(echo "$LINE" | awk '{print $3}')
        IFACE=$(echo "$LINE" | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')
        METRIC=$(echo "$LINE" | grep -oP 'metric \K[0-9]+' | head -n1)

        echo "Interface : $IFACE"
        echo "Gateway   : $GW"
        echo "Metric    : ${METRIC:-0}"
        echo

        if ping -c 1 -W "$PING_TIMEOUT" -I "$IFACE" "$GW" >/dev/null 2>&1; then
            pass "$IFACE → gateway $GW"
        else
            fail "$IFACE → gateway $GW no responde"
        fi

    done <<< "$DEFAULTS"
}

# ============================================================
# LATENCY / LOSS
# ============================================================

test_gateway_latency() {

    echo
    echo "---------------- LATENCY / LOSS ----------------"

    DEFAULTS=$(ip route show default)

    while read -r LINE; do

        [ -z "$LINE" ] && continue

        GW=$(echo "$LINE" | awk '{print $3}')
        IFACE=$(echo "$LINE" | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')

        echo
        echo "Interface: $IFACE"
        echo "Gateway:   $GW"

        RESULT=$(ping -c "$PING_COUNT" -W "$PING_TIMEOUT" -I "$IFACE" "$GW" 2>/dev/null)

        LOSS=$(echo "$RESULT" | grep -oP '\d+(?=% packet loss)' | head -n1)

        RTT=$(echo "$RESULT" |
            grep -E 'rtt|round-trip' |
            awk -F'=' '{print $2}' |
            cut -d'/' -f2)

        [ -z "$LOSS" ] && LOSS=100

            if [ "$IFACE" = "$INTERNET_DEV" ]; then
                PRIMARY_PACKET_LOSS="$LOSS"
                PRIMARY_PING_MS="$RTT"
            fi

        echo "Loss: ${LOSS}%"
        echo "RTT : ${RTT:-N/A} ms"

        if [ "$LOSS" -eq 0 ]; then
            pass "$IFACE sin pérdida hacia gateway"
        elif [ "$LOSS" -lt 5 ]; then
            warning "$IFACE presenta ${LOSS}% de pérdida"
        else
            fail "$IFACE presenta ${LOSS}% de pérdida"
        fi

    done <<< "$DEFAULTS"
}

# ============================================================
# DNS
# ============================================================

test_dns() {

    echo
    echo "---------------- DNS ----------------"

    if [ ! -f /etc/resolv.conf ]; then
        fail "/etc/resolv.conf no existe"
        return
    fi

    SERVERS=$(grep '^nameserver' /etc/resolv.conf | awk '{print $2}')

        DNS_SERVERS="$SERVERS"

    if [ -z "$SERVERS" ]; then
        fail "No hay servidores DNS configurados"
        return
    fi

    echo "DNS configurados:"
    echo "$SERVERS"
    echo

    IPV4=$(getent ahostsv4 tecnocom180.com 2>/dev/null |
        awk '{print $1}' | sort -u)

    if [ -n "$IPV4" ]; then
        echo "IPv4:"
        echo "$IPV4"
        pass "Resolución DNS IPv4"
    else
        fail "No se pudo resolver DNS IPv4"
    fi

    echo

    IPV6=$(getent ahostsv6 tecnocom180.com 2>/dev/null |
        awk '{print $1}' | sort -u)

    if [ -n "$IPV6" ]; then
        echo "IPv6:"
        echo "$IPV6"
        pass "Resolución DNS IPv6"
    else
        warning "No se pudo resolver DNS IPv6"
    fi

    echo

    GENERAL=$(getent hosts tecnocom180.com 2>/dev/null)

    if [ -n "$GENERAL" ]; then
    DNS_OK=true
    pass "Resolver DNS operativo"
else
    DNS_OK=false
    fail "Resolver DNS no responde"
fi
}

# ============================================================
# INTERNET
# ============================================================

test_internet() {

    echo
    echo "---------------- INTERNET ----------------"

    if ping -c 3 -W 2 8.8.8.8 >/dev/null 2>&1; then
    INTERNET_OK=true
    pass "Conectividad IP a Internet"
else
    INTERNET_OK=false
    fail "Sin conectividad IP a Internet"
fi
}

# ============================================================
# NEIGHBORS
# ============================================================

test_neighbors() {

    echo
    echo "---------------- NEIGHBORS ----------------"

    for IFACE in eth0 wlan0; do

        if [ ! -d "/sys/class/net/$IFACE" ]; then
            skip "$IFACE no existe"
            continue
        fi

        REACHABLE=$(ip neigh show dev "$IFACE" |
            grep -c 'REACHABLE' || true)

        STALE=$(ip neigh show dev "$IFACE" |
            grep -c 'STALE' || true)

        FAILED=$(ip neigh show dev "$IFACE" |
            grep -c 'FAILED' || true)

        TOTAL=$(ip neigh show dev "$IFACE" |
            wc -l)

        echo
        echo "$IFACE"
        echo "Total      : $TOTAL"
        echo "Reachable  : $REACHABLE"
        echo "Stale      : $STALE"
        echo "Failed     : $FAILED"

        if [ "$FAILED" -gt 0 ]; then
            warning "$IFACE tiene $FAILED vecinos FAILED"
        else
            pass "$IFACE sin vecinos FAILED"
        fi

    done
}

# ============================================================
# MAC DUPLICATES
# ============================================================

test_mac_duplicates() {

    echo
    echo "---------------- MAC DUPLICATES ----------------"

    FOUND=0

    for IFACE in eth0 wlan0; do

        if [ ! -d "/sys/class/net/$IFACE" ]; then
            continue
        fi

        DUPLICATES=$(ip neigh show dev "$IFACE" |
            awk '$3 != "" && $3 != "FAILED" {print $3, $1}' |
            sort |
            awk '
            {
                mac=$1
                ip=$2
                if (count[mac] == 0) {
                    ips[mac]=ip
                } else {
                    ips[mac]=ips[mac] " " ip
                }
                count[mac]++
            }
            END {
                for (mac in count)
                    if (count[mac] > 1)
                        print mac "|" count[mac] "|" ips[mac]
            }')

        if [ -n "$DUPLICATES" ]; then

            FOUND=1

            echo
            echo "Interface: $IFACE"

            while IFS='|' read -r MAC COUNT IPS; do
                echo "MAC : $MAC"
                echo "IPs : $IPS"
                echo
            done <<< "$DUPLICATES"

        fi

    done

    if [ "$FOUND" -eq 0 ]; then
        pass "No se detectaron MAC duplicadas"
    else
        warning "Se detectaron MAC asociadas a múltiples IP"
    fi
}

# ============================================================
# WIFI
# ============================================================

test_wifi() {

    echo
    echo "---------------- WIFI ----------------"

    if [ ! -d /sys/class/net/wlan0 ]; then
        skip "wlan0 no existe"
        return
    fi

    WIFI=$(iw dev wlan0 link 2>/dev/null)

    if echo "$WIFI" | grep -q "Not connected"; then
        warning "wlan0 no está conectado"
        return
    fi

    if [ -z "$WIFI" ]; then
        warning "No se pudo obtener información WiFi"
        return
    fi

    echo "$WIFI"

    SSID=$(echo "$WIFI" | grep 'SSID:' | sed 's/.*SSID: //')
    BSSID=$(echo "$WIFI" | grep 'Connected to' | awk '{print $3}')
    SIGNAL=$(echo "$WIFI" | grep 'signal' | awk '{print $2}')
    FREQ=$(echo "$WIFI" | grep 'freq:' | awk '{print $2}')
    RX_RATE=$(echo "$WIFI" | grep 'rx bitrate:' | awk '{print $3}')
    TX_RATE=$(echo "$WIFI" | grep 'tx bitrate:' | awk '{print $3}')

    echo
    echo "SSID        : ${SSID:-N/A}"
    echo "BSSID       : ${BSSID:-N/A}"
    echo "Frequency   : ${FREQ:-N/A} MHz"
    echo "Signal      : ${SIGNAL:-N/A} dBm"
    echo "RX bitrate  : ${RX_RATE:-N/A} MBit/s"
    echo "TX bitrate  : ${TX_RATE:-N/A} MBit/s"

    if [ -n "$SIGNAL" ]; then

        SIGNAL_INT=${SIGNAL%.*}

        if [ "$SIGNAL_INT" -ge -67 ]; then
            pass "Señal WiFi buena"
        elif [ "$SIGNAL_INT" -ge -75 ]; then
            warning "Señal WiFi moderada"
        else
            fail "Señal WiFi débil"
        fi

    else
        warning "No se pudo determinar señal WiFi"
    fi

    echo
    echo "[INFO] RX/TX bitrate representa tasa PHY instantánea"
    echo "[INFO] No se utiliza como criterio de FAIL"
}

# ============================================================
# SUMMARY
# ============================================================

summary() {

    echo
    echo "============================================================"
    echo " RESULTADO"
    echo "============================================================"

    echo
    echo "PASS    : $PASS_COUNT"
    echo "WARNING : $WARNING_COUNT"
    echo "FAIL    : $FAIL_COUNT"
    echo "SKIP    : $SKIP_COUNT"

    echo

    if [ "$FAIL_COUNT" -gt 0 ]; then
        echo "DIAGNOSTICO: FAIL"
    elif [ "$WARNING_COUNT" -gt 0 ]; then
        echo "DIAGNOSTICO: WARNING"
    else
        echo "DIAGNOSTICO: PASS"
    fi

    echo
    echo "============================================================"
}

# ============================================================
# SPEEDTEST
# ============================================================

test_speedtest_interface() {

    local IFACE="$1"
    local LABEL="$2"

    echo
    echo "---------------- SPEEDTEST $LABEL ----------------"

    if ! command -v speedtest >/dev/null 2>&1; then
        skip "speedtest no está instalado"
        return
    fi

    if ! ip link show "$IFACE" >/dev/null 2>&1; then
        skip "$IFACE no existe"
        return
    fi

    echo "Interface : $IFACE"
    echo "Ejecutando Speedtest..."

    local OUTPUT
    OUTPUT=$(speedtest -I "$IFACE" --format=json 2>/dev/null)

    local RESULT_JSON

    RESULT_JSON=$(echo "$OUTPUT" | grep '"type":"result"' | tail -n1)

    if [ -z "$RESULT_JSON" ]; then
        warning "$IFACE Speedtest no produjo resultado"
        return
    fi

    local DOWNLOAD_BPS
    local UPLOAD_BPS
    local LATENCY
    local JITTER
    local PACKET_LOSS
    local SERVER

    DOWNLOAD_BPS=$(echo "$RESULT_JSON" |
        grep -oP '"download":\{"bandwidth":\K[0-9.]+' |
        head -n1)

    UPLOAD_BPS=$(echo "$RESULT_JSON" |
        grep -oP '"upload":\{"bandwidth":\K[0-9.]+' |
        head -n1)

    LATENCY=$(echo "$RESULT_JSON" |
        grep -oP '"ping":\{"jitter":[0-9.]+,"latency":\K[0-9.]+' |
        head -n1)

    JITTER=$(echo "$RESULT_JSON" |
        grep -oP '"ping":\{"jitter":\K[0-9.]+' |
        head -n1)

    PACKET_LOSS=$(echo "$RESULT_JSON" |
        grep -oP '"packetLoss":\K[0-9.]+' |
        head -n1)

    SERVER=$(echo "$RESULT_JSON" |
        grep -oP '"server":\{[^}]*"name":"\K[^"]+' |
        head -n1)

    # Speedtest bandwidth viene expresado en bytes/segundo.
    # Convertimos a Mbps.
    if [ -n "$DOWNLOAD_BPS" ]; then
        DOWNLOAD_MBPS=$(awk "BEGIN {printf \"%.2f\", ($DOWNLOAD_BPS * 8) / 1000000}")
    fi

    if [ -n "$UPLOAD_BPS" ]; then
        UPLOAD_MBPS=$(awk "BEGIN {printf \"%.2f\", ($UPLOAD_BPS * 8) / 1000000}")
    fi

    echo "Download   : ${DOWNLOAD_MBPS:-N/A} Mbps"
    echo "Upload     : ${UPLOAD_MBPS:-N/A} Mbps"
    echo "Latency    : ${LATENCY:-N/A} ms"
    echo "Jitter     : ${JITTER:-N/A} ms"
    echo "Packet Loss: ${PACKET_LOSS:-N/A}%"
    echo "Server     : ${SERVER:-N/A}"

    if [ "$IFACE" = "eth0" ]; then

        ETH_DOWNLOAD_MBPS="$DOWNLOAD_MBPS"
        ETH_UPLOAD_MBPS="$UPLOAD_MBPS"
        ETH_LATENCY_MS="$LATENCY"
        ETH_JITTER_MS="$JITTER"
        ETH_PACKET_LOSS="$PACKET_LOSS"
        ETH_SPEEDTEST_SERVER="$SERVER"

        SPEEDTEST_ETH_OK=true

    elif [ "$IFACE" = "wlan0" ]; then

        WIFI_DOWNLOAD_MBPS="$DOWNLOAD_MBPS"
        WIFI_UPLOAD_MBPS="$UPLOAD_MBPS"
        WIFI_LATENCY_MS="$LATENCY"
        WIFI_JITTER_MS="$JITTER"
        WIFI_PACKET_LOSS="$PACKET_LOSS"
        WIFI_SPEEDTEST_SERVER="$SERVER"

        SPEEDTEST_WIFI_OK=true

    fi

    pass "$IFACE Speedtest completado"
}

# ============================================================
# JSON OUTPUT
# ============================================================

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

json_output() {

    local DIAGNOSTIC_STATUS="PASS"

    if [ "$FAIL_COUNT" -gt 0 ]; then
        DIAGNOSTIC_STATUS="FAIL"
    elif [ "$WARNING_COUNT" -gt 0 ]; then
        DIAGNOSTIC_STATUS="WARNING"
    fi

    local DNS_JSON=""
    if [ -n "$DNS_SERVERS" ]; then
        DNS_JSON=$(echo "$DNS_SERVERS" |
            awk '{printf "%s\"%s\"", (NR>1?",":""), $0}')
    fi

    cat <<EOF
{
  "status": "$DIAGNOSTIC_STATUS",
  "summary": {
    "pass": $PASS_COUNT,
    "warning": $WARNING_COUNT,
    "fail": $FAIL_COUNT,
    "skip": $SKIP_COUNT
  },
  "internetRoute": {
    "interface": "$(json_escape "$INTERNET_DEV")",
    "sourceIp": "$(json_escape "$INTERNET_SRC")",
    "gateway": "$(json_escape "$INTERNET_GW")"
  },
  "latency": {
    "pingMs": ${PRIMARY_PING_MS:-null},
    "packetLoss": ${PRIMARY_PACKET_LOSS:-null}
  },
  "dns": {
    "servers": [$DNS_JSON],
    "operational": $DNS_OK
  },
  "internet": $INTERNET_OK,
  "wifi": {
    "ssid": "$(json_escape "${SSID:-}")",
    "bssid": "$(json_escape "${BSSID:-}")",
    "frequencyMHz": ${FREQ:-null},
    "signalDbm": ${SIGNAL:-null},
    "rxBitrateMbps": ${RX_RATE:-null},
    "txBitrateMbps": ${TX_RATE:-null}
  },
  "speedtest": {
    "ethernet": {
      "interface": "eth0",
      "downloadMbps": ${ETH_DOWNLOAD_MBPS:-null},
      "uploadMbps": ${ETH_UPLOAD_MBPS:-null},
      "latencyMs": ${ETH_LATENCY_MS:-null},
      "jitterMs": ${ETH_JITTER_MS:-null},
      "packetLoss": ${ETH_PACKET_LOSS:-null},
      "server": "$(json_escape "$ETH_SPEEDTEST_SERVER")"
    },
    "wifi": {
      "interface": "wlan0",
      "downloadMbps": ${WIFI_DOWNLOAD_MBPS:-null},
      "uploadMbps": ${WIFI_UPLOAD_MBPS:-null},
      "latencyMs": ${WIFI_LATENCY_MS:-null},
      "jitterMs": ${WIFI_JITTER_MS:-null},
      "packetLoss": ${WIFI_PACKET_LOSS:-null},
      "server": "$(json_escape "$WIFI_SPEEDTEST_SERVER")"
    }
  }
}
EOF
}

# ============================================================
# MAIN
# ============================================================

if [ "$1" = "--json" ]; then

    test_system >/dev/null
    test_interfaces >/dev/null
    test_link >/dev/null
    test_network_manager >/dev/null
    test_routing >/dev/null
    test_internet_route >/dev/null
    test_gateways >/dev/null
    test_gateway_latency >/dev/null
    test_dns >/dev/null
    test_internet >/dev/null
    test_neighbors >/dev/null
    test_mac_duplicates >/dev/null
    test_wifi >/dev/null
    test_speedtest_interface eth0 "ETHERNET" >/dev/null
    test_speedtest_interface wlan0 "WIFI" >/dev/null

    json_output

else

    print_header

    test_system
    test_interfaces
    test_link
    test_network_manager
    test_routing
    test_internet_route
    test_gateways
    test_gateway_latency
    test_dns
    test_internet
    test_neighbors
    test_mac_duplicates
    test_wifi

    summary

fi