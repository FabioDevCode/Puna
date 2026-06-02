#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Puna — Interactive Environment Setup
#
# Generates a complete .env file through an interactive CLI.
# Requires only bash 3.2+ and openssl — no other dependencies.
#
# Usage:
#   bash setup.sh || sh setup.sh                    (interactive)
#   curl -fsSL <url>/setup.sh | bash
#   printf "fr\nn\n...\n" | bash setup.sh   (CI / pipe mode)
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# ─── Paths ───────────────────────────────────────────────────────────────────

# When piped via curl | bash, $BASH_SOURCE[0] is empty — fall back to PWD
if [ -n "${BASH_SOURCE[0]:-}" ] && [ "${BASH_SOURCE[0]}" != "bash" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/." && pwd)"
else
    PROJECT_ROOT="$(pwd)"
fi

ENV_PATH="$PROJECT_ROOT/.env"
ENV_BACKUP_PATH="$PROJECT_ROOT/.env.backup"

# ─── Prerequisites ────────────────────────────────────────────────────────────

if ! command -v openssl > /dev/null 2>&1; then
    echo "❌ openssl is required but not found. Install it and retry." >&2
    exit 1
fi

# ─── Colors ──────────────────────────────────────────────────────────────────

if [ -t 1 ]; then
    RED='\033[31m'
    YELLOW='\033[33m'
    GREEN='\033[32m'
    CYAN='\033[36m'
    BLUE='\033[34m'
    GRAY='\033[30m'
    RESET='\033[0m'
else
    RED='' YELLOW='' GREEN='' CYAN='' BLUE='' GRAY='' RESET=''
fi

# ─── i18n ─────────────────────────────────────────────────────────────────────

LANG_CHOICE="fr"

t() {
    local key="$1"
    if [ "$LANG_CHOICE" = "en" ]; then
        case "$key" in
            langChoice)          printf "Langue / Language" ;;
            envFound)            printf "${YELLOW}⚠ An existing .env file was found.${RESET}" ;;
            envOverwrite)        printf "Overwrite and create .env.backup?" ;;
            envCancelled)        printf "Setup cancelled. Your .env file was not modified." ;;
            envBackupSaved)      printf "${GREEN}✔ Backup saved to .env.backup${RESET}" ;;
            secKeysGenerated)    printf "${GREEN}✔ All security keys generated automatically.${RESET}" ;;
            defaultsInfo)        printf "${GREEN}✔ Using defaults. Edit .env to customize.${RESET}" ;;
            nodeEnvInfo)         printf "  ${GRAY}NODE_ENV=production${RESET}" ;;
            appUrlInfo)          printf "APP_URL" ;;
            clamavDisableHint)   printf "  ${CYAN}→ To disable later: set CLAMAV_ENABLED=false in .env${RESET}" ;;
            totpDisableHint)     printf "  ${CYAN}→ To disable later: set TOTP_ENABLED=false in .env${RESET}" ;;
            helmetInfo)          printf "  HELMET_STRICT_TRANSPORT=false" ;;
            trustProxyInfo)      printf "  TRUST_PROXY=false" ;;
            logsRetention)       printf "  Retention: app=7d, api=14d, error=30d, audit=90d" ;;
            logsConsole)         printf "  LOG_TO_CONSOLE=true" ;;
            rateInfo)            printf "  Form: 30 req / 60s | Login: 10 failed attempts max" ;;
            uploadInfo)          printf "  File: 10 MB | Total: 50 MB | Files: 10 | Fields: 40" ;;
            clamavEnable)        printf "Enable ClamAV (antivirus scan)?" ;;
            clamavSkipped)       printf "  ${CYAN}→ Skipped. Set CLAMAV_ENABLED=true in .env to enable later.${RESET}" ;;
            clamavSocketHint)    printf "CLAMAV_SOCKET (leave empty for TCP)" ;;
            clamavHostHint)      printf "CLAMAV_HOST (used if socket is empty)" ;;
            smtpEnable)          printf "Configure SMTP for email features?" ;;
            smtpSkipped)         printf "  ${CYAN}→ SMTP variables added as comments in .env.${RESET}" ;;
            smtpSkippedHint)     printf "    Uncomment them to enable mail features." ;;
            totpEnable)          printf "Enable two-factor authentication (TOTP)?" ;;
            totpSkipped)         printf "  ${CYAN}→ Skipped. Set TOTP_ENABLED=true in .env to enable later.${RESET}" ;;
            adminLogin)          printf "Admin login" ;;
            adminEmail)          printf "Admin email (optional)" ;;
            mcpEnable)           printf "Enable MCP server (AI integration)?" ;;
            mcpDisableHint)      printf "  ${CYAN}→ To enable later: set MCP_ENABLED=true in .env${RESET}" ;;
            mcpSkipped)          printf "  ${CYAN}→ Skipped. Set MCP_ENABLED=true in .env to enable later.${RESET}" ;;
            mcpKeyGenerated)     printf "  MCP_HASH_SECRET generated automatically." ;;
            successCreated)      printf "${GREEN}✔ .env file created successfully.${RESET}" ;;
        esac
    else
        case "$key" in
            langChoice)          printf "Langue / Language" ;;
            envFound)            printf "${YELLOW}⚠ Un fichier .env existant a été trouvé.${RESET}" ;;
            envOverwrite)        printf "Écraser et créer un .env.backup ?" ;;
            envCancelled)        printf "Installation annulée. Votre fichier .env n'a pas été modifié." ;;
            envBackupSaved)      printf "${GREEN}✔ Sauvegarde enregistrée dans .env.backup${RESET}" ;;
            secKeysGenerated)    printf "${GREEN}✔ Toutes les clés de sécurité ont été générées automatiquement.${RESET}" ;;
            defaultsInfo)        printf "${GREEN}✔ Valeurs par défaut appliquées. Modifiez le .env pour personnaliser.${RESET}" ;;
            nodeEnvInfo)         printf "  ${GRAY}NODE_ENV=production${RESET}" ;;
            appUrlInfo)          printf "APP_URL" ;;
            dialectInfo)         printf "  ${GRAY}DB_DIALECT=mariadb (seul dialecte supporté actuellement)${RESET}" ;;
            clamavDisableHint)   printf "  ${CYAN}→ Pour désactiver plus tard : CLAMAV_ENABLED=false dans .env${RESET}" ;;
            totpDisableHint)     printf "  ${CYAN}→ Pour désactiver plus tard : TOTP_ENABLED=false dans .env${RESET}" ;;
            helmetInfo)          printf "  HELMET_STRICT_TRANSPORT=false" ;;
            trustProxyInfo)      printf "  TRUST_PROXY=false" ;;
            logsRetention)       printf "  Rétention : app=7j, api=14j, error=30j, audit=90j" ;;
            logsConsole)         printf "  LOG_TO_CONSOLE=true" ;;
            rateInfo)            printf "  Formulaire : 30 req / 60s | Connexion : 10 tentatives max" ;;
            uploadInfo)          printf "  Fichier : 10 Mo | Total : 50 Mo | Fichiers : 10 | Champs : 40" ;;
            clamavEnable)        printf "Activer ClamAV (scan antivirus) ?" ;;
            clamavSkipped)       printf "  ${CYAN}→ Ignoré. Définissez CLAMAV_ENABLED=true dans .env pour activer plus tard.${RESET}" ;;
            clamavSocketHint)    printf "CLAMAV_SOCKET (laisser vide pour TCP)" ;;
            clamavHostHint)      printf "CLAMAV_HOST (utilisé si socket est vide)" ;;
            smtpEnable)          printf "Configurer SMTP pour les emails ?" ;;
            smtpSkipped)         printf "  ${CYAN}→ Variables SMTP ajoutées en commentaire dans .env.${RESET}" ;;
            smtpSkippedHint)     printf "    Décommentez-les pour activer la fonctionnalité email." ;;
            totpEnable)          printf "Activer l'authentification à deux facteurs (TOTP) ?" ;;
            totpSkipped)         printf "  ${CYAN}→ Ignoré. Définissez TOTP_ENABLED=true dans .env pour activer plus tard.${RESET}" ;;
            adminLogin)          printf "Login administrateur" ;;
            adminEmail)          printf "Email administrateur (optionnel)" ;;
            mcpEnable)           printf "Activer le serveur MCP (intégration IA) ?" ;;
            mcpDisableHint)      printf "  ${CYAN}→ Pour activer plus tard : MCP_ENABLED=true dans .env${RESET}" ;;
            mcpSkipped)          printf "  ${CYAN}→ Ignoré. Définissez MCP_ENABLED=true dans .env pour activer plus tard.${RESET}" ;;
            mcpKeyGenerated)     printf "  MCP_HASH_SECRET générée automatiquement." ;;
            successCreated)      printf "${GREEN}✔ Fichier .env créé avec succès.${RESET}" ;;
        esac
    fi
    printf "\n"
}

# ─── Key generation ──────────────────────────────────────────────────────────

gen_hex() {
    openssl rand -hex "$1"
}

gen_b64url() {
    openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '=\n'
}

# ─── TTY detection & pipe mode buffer ────────────────────────────────────────

IS_TTY=0
PIPE_LINES=()
PIPE_CURSOR=0

if [ -t 0 ]; then
    IS_TTY=1
else
    # Pre-buffer all stdin lines for sequential distribution
    while IFS= read -r line; do
        PIPE_LINES+=("$line")
    done
fi

_next_pipe_line() {
    local val=""
    if [ "$PIPE_CURSOR" -lt "${#PIPE_LINES[@]}" ]; then
        val="${PIPE_LINES[$PIPE_CURSOR]}"
        PIPE_CURSOR=$((PIPE_CURSOR + 1))
    fi
    echo "$val"
}

# ─── Prompt functions ─────────────────────────────────────────────────────────

# ask <question> [default]
# Prompts are sent to /dev/tty so they don't pollute the $() capture.
# Only the final value is written to stdout.
ask() {
    local question="$1"
    local default="${2:-}"
    local display=""
    local answer=""

    if [ -n "$default" ]; then
        display=" [$default]"
    fi

    if [ "$IS_TTY" -eq 1 ]; then
        read -r -p "? ${question}${display} : " answer < /dev/tty > /dev/tty 2>&1 || true
        answer="${answer:-$default}"
    else
        answer="$(_next_pipe_line)"
        answer="${answer:-$default}"
        printf "? %s%s : %s\n" "$question" "$display" "$answer" > /dev/tty
    fi

    printf "%s" "$answer"
}

# ask_password <question>
ask_password() {
    local question="$1"
    local answer=""

    if [ "$IS_TTY" -eq 1 ]; then
        printf "? %s : " "$question" > /dev/tty
        IFS= read -rs answer < /dev/tty
        printf "\n" > /dev/tty
    else
        answer="$(_next_pipe_line)"
        local masked=""
        local i=0
        while [ $i -lt ${#answer} ]; do
            masked="${masked}*"
            i=$((i + 1))
        done
        printf "? %s : %s\n" "$question" "$masked" > /dev/tty
    fi

    printf "%s" "$answer"
}

# ask_yes_no <question> <default_no: true|false>
# default_no=true  → default is NO  → hint (y/N)
# default_no=false → default is YES → hint (Y/n)
ask_yes_no() {
    local question="$1"
    local default_no="${2:-true}"
    local hint answer a

    if [ "$default_no" = "true" ]; then
        hint="(y/N)"
    else
        hint="(Y/n)"
    fi

    if [ "$IS_TTY" -eq 1 ]; then
        read -r -p "? ${question} ${hint} : " answer < /dev/tty > /dev/tty 2>&1 || true
    else
        answer="$(_next_pipe_line)"
        printf "? %s %s : %s\n" "$question" "$hint" "$answer" > /dev/tty
    fi

    a=$(printf "%s" "$answer" | tr '[:upper:]' '[:lower:]')

    if [ -z "$a" ]; then
        if [ "$default_no" = "true" ]; then
            printf "false"   # default NO
        else
            printf "true"    # default YES
        fi
    elif [ "$a" = "y" ] || [ "$a" = "yes" ]; then
        printf "true"
    else
        printf "false"
    fi
}

# section_header <num> <total> <title>
section_header() {
    local num="$1" total="$2" title="$3"
    local dashes=""
    local pad=$((40 - ${#title}))
    if [ "$pad" -lt 0 ]; then pad=0; fi
    local i=0
    while [ $i -lt $pad ]; do
        dashes="${dashes}─"
        i=$((i + 1))
    done
    printf "${BLUE}\n── %s/%s %s %s${RESET}\n" "$num" "$total" "$title" "$dashes"
}

# ─── Quoting helper ───────────────────────────────────────────────────────────

# env_line <KEY> <VALUE>
# Adds quotes around the value if it contains spaces, #, ", ', or is empty
env_line() {
    local key="$1"
    local value="$2"
    # Check if quoting needed: empty, or contains space/#/"/\'
    if [ -z "$value" ] || echo "$value" | grep -qE '[[:space:]#"'"'"']'; then
        echo "${key}=\"${value}\""
    else
        echo "${key}=${value}"
    fi
}

# ─── .env builder ─────────────────────────────────────────────────────────────

write_env() {
    # Application
    echo "# Application"
    env_line "NODE_ENV"    "$E_NODE_ENV"
    env_line "PORT"        "$E_PORT"
    env_line "APP_URL"     "$E_APP_URL"
    echo ""

    # Helmet
    echo "# Helmet"
    env_line "HELMET_STRICT_TRANSPORT" "$E_HELMET_STRICT_TRANSPORT"
    echo ""

    # Database
    echo "# Database"
    env_line "DB_IP"      "$E_DB_IP"
    env_line "DB_PORT"    "$E_DB_PORT"
    env_line "DB_USER"    "$E_DB_USER"
    env_line "DB_PWD"     "$E_DB_PWD"
    env_line "DB_NAME"    "$E_DB_NAME"
    env_line "DB_DIALECT" "$E_DB_DIALECT"
    echo ""

    # SMTP
    echo "# SMTP"
    if [ "$E_SMTP_ENABLED" = "true" ]; then
        env_line "SMTP_HOST" "$E_SMTP_HOST"
        env_line "SMTP_PORT" "$E_SMTP_PORT"
        env_line "SMTP_USER" "$E_SMTP_USER"
        env_line "SMTP_PASS" "$E_SMTP_PASS"
        env_line "SMTP_FROM" "$E_SMTP_FROM"
    else
        echo '# SMTP_HOST="smtp.example.com"'
        echo '# SMTP_PORT=587'
        echo '# SMTP_USER="no-reply@example.com"'
        echo '# SMTP_PASS="your_smtp_password_here"'
        echo '# SMTP_FROM="Puna <no-reply@example.com>"'
    fi
    echo ""

    # Security Keys
    echo "# Security Keys (auto-generated)"
    env_line "KEY_TK" "$E_KEY_TK"
    env_line "KEV"    "$E_KEV"
    env_line "KIV"    "$E_KIV"
    echo ""

    # Session
    echo "# Session"
    env_line "SESSION_SECRET"  "$E_SESSION_SECRET"
    env_line "SESSION_MAX_AGE" "$E_SESSION_MAX_AGE"
    echo ""

    # CSRF
    echo "# CSRF"
    env_line "CSRF_SECRET" "$E_CSRF_SECRET"
    echo ""

    # API Key
    echo "# API Key"
    env_line "API_KEY" "$E_API_KEY"
    echo ""

    # Logs
    echo "# Logs — retention in days"
    env_line "LOG_RETENTION_APP"   "$E_LOG_RETENTION_APP"
    env_line "LOG_RETENTION_API"   "$E_LOG_RETENTION_API"
    env_line "LOG_RETENTION_ERROR" "$E_LOG_RETENTION_ERROR"
    env_line "LOG_RETENTION_AUDIT" "$E_LOG_RETENTION_AUDIT"
    env_line "LOG_TO_CONSOLE"      "$E_LOG_TO_CONSOLE"
    echo ""

    # Rate Limiting
    echo "# Rate Limiting"
    env_line "RATE_LIMIT_FORM_MAX"       "$E_RATE_LIMIT_FORM_MAX"
    env_line "RATE_LIMIT_FORM_WINDOW_MS" "$E_RATE_LIMIT_FORM_WINDOW_MS"
    env_line "MAX_FAILED_LOGIN_ATTEMPTS" "$E_MAX_FAILED_LOGIN_ATTEMPTS"
    echo ""

    # Upload Limits
    echo "# Upload Limits"
    env_line "API_MAX_FILE_SIZE"  "$E_API_MAX_FILE_SIZE"
    env_line "API_MAX_TOTAL_SIZE" "$E_API_MAX_TOTAL_SIZE"
    env_line "API_MAX_FILES"      "$E_API_MAX_FILES"
    env_line "API_MAX_FIELDS"     "$E_API_MAX_FIELDS"
    env_line "API_MAX_FIELD_SIZE" "$E_API_MAX_FIELD_SIZE"
    echo ""

    # ClamAV
    echo "# ClamAV"
    env_line "CLAMAV_ENABLED" "$E_CLAMAV_ENABLED"
    if [ "$E_CLAMAV_ENABLED" = "true" ]; then
        env_line "CLAMAV_SOCKET" "$E_CLAMAV_SOCKET"
        env_line "CLAMAV_HOST"   "$E_CLAMAV_HOST"
        env_line "CLAMAV_PORT"   "$E_CLAMAV_PORT"
    fi
    echo ""

    # TOTP
    echo "# TOTP (2FA)"
    env_line "TOTP_ENABLED" "$E_TOTP_ENABLED"
    env_line "TOTP_ISSUER"  "$E_TOTP_ISSUER"
    echo ""

    # Admin
    echo "# Admin"
    env_line "ADMIN_LOGIN" "$E_ADMIN_LOGIN"
    env_line "ADMIN_EMAIL" "$E_ADMIN_EMAIL"
    echo ""

    # MCP
    echo "# MCP"
    env_line "MCP_ENABLED"     "$E_MCP_ENABLED"
    env_line "MCP_HASH_SECRET" "$E_MCP_HASH_SECRET"
    echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    local TOTAL_SECTIONS=12

    # ── Banner ────────────────────────────────────────────────────────────────
    echo ""
    cat << 'BANNER'

             xddddd
         ddddddddddd ccccc
       ddddddddddddd cccccc ''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
        dddddddddddd cccccc ''''
           kdddddddd cccc
             xddddd
BANNER
    echo ""
    echo "╔═══════════════════════════════════════╗"
    printf "║     ${BLUE}Puna - Production Env Setup${RESET}       ║\n"
    echo "╚═══════════════════════════════════════╝"
    echo ""

    # ── Language selection ────────────────────────────────────────────────────

    local lang_input
    lang_input="$(ask "Langue / Language (fr/en)" "fr")"
    lang_input=$(echo "$lang_input" | tr '[:upper:]' '[:lower:]')
    if [ "$lang_input" = "en" ]; then
        LANG_CHOICE="en"
    else
        LANG_CHOICE="fr"
    fi

    # ── Existing .env check ───────────────────────────────────────────────────

    if [ -f "$ENV_PATH" ]; then
        t envFound
        local overwrite
        overwrite="$(ask_yes_no "$(t envOverwrite)" "true")"
        if [ "$overwrite" = "false" ]; then
            echo ""
            t envCancelled
            exit 0
        fi
        cp "$ENV_PATH" "$ENV_BACKUP_PATH"
        t envBackupSaved
        echo ""
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # Section 1 — Application
    # ─────────────────────────────────────────────────────────────────────────

    section_header 1 $TOTAL_SECTIONS "Application"
    E_NODE_ENV="production"
    t nodeEnvInfo
    E_PORT="$(ask "PORT" "3022")"
    E_APP_URL="$(ask "$(t appUrlInfo)" "http://localhost:${E_PORT}")"

    # ─────────────────────────────────────────────────────────────────────────
    # Section 2 — Database
    # ─────────────────────────────────────────────────────────────────────────

    section_header 2 $TOTAL_SECTIONS "Database"
    E_DB_IP="$(ask "DB_IP" "127.0.0.1")"
    E_DB_PORT="$(ask "DB_PORT" "3306")"
    E_DB_USER="$(ask "DB_USER" "root")"
    E_DB_PWD="$(ask_password "DB_PWD")"
    E_DB_NAME="$(ask "DB_NAME" "puna")"
    E_DB_DIALECT="mariadb"
    t dialectInfo

    # ─────────────────────────────────────────────────────────────────────────
    # Section 3 — SMTP (optional)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 3 $TOTAL_SECTIONS "SMTP"
    local enable_smtp
    enable_smtp="$(ask_yes_no "$(t smtpEnable)" "true")"
    E_SMTP_ENABLED="$enable_smtp"

    if [ "$enable_smtp" = "true" ]; then
        E_SMTP_HOST="$(ask "SMTP_HOST" "smtp.example.com")"
        E_SMTP_PORT="$(ask "SMTP_PORT" "587")"
        E_SMTP_USER="$(ask "SMTP_USER" "")"
        E_SMTP_PASS="$(ask_password "SMTP_PASS")"
        local smtp_from_default="Puna <${E_SMTP_USER:-no-reply@example.com}>"
        E_SMTP_FROM="$(ask "SMTP_FROM" "$smtp_from_default")"
    else
        E_SMTP_HOST="" E_SMTP_PORT="" E_SMTP_USER="" E_SMTP_PASS="" E_SMTP_FROM=""
        t smtpSkipped
        t smtpSkippedHint
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # Section 4 — Admin
    # ─────────────────────────────────────────────────────────────────────────

    section_header 4 $TOTAL_SECTIONS "Admin"
    E_ADMIN_LOGIN="$(ask "$(t adminLogin)" "admin")"
    E_ADMIN_EMAIL="$(ask "$(t adminEmail)" "")"

    # ─────────────────────────────────────────────────────────────────────────
    # Section 5 — TOTP (optional)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 5 $TOTAL_SECTIONS "TOTP (2FA)"
    local enable_totp
    enable_totp="$(ask_yes_no "$(t totpEnable)" "true")"

    if [ "$enable_totp" = "true" ]; then
        E_TOTP_ENABLED="true"
        E_TOTP_ISSUER="$(ask "TOTP_ISSUER" "Puna")"
        t totpDisableHint
    else
        E_TOTP_ENABLED="false"
        E_TOTP_ISSUER="Puna"
        t totpSkipped
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # Section 6 — ClamAV (optional)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 6 $TOTAL_SECTIONS "ClamAV"
    local enable_clamav
    enable_clamav="$(ask_yes_no "$(t clamavEnable)" "true")"

    if [ "$enable_clamav" = "true" ]; then
        E_CLAMAV_ENABLED="true"
        E_CLAMAV_SOCKET="$(ask "$(t clamavSocketHint)" "/tmp/clamd.socket")"
        E_CLAMAV_HOST="$(ask "$(t clamavHostHint)" "127.0.0.1")"
        E_CLAMAV_PORT="$(ask "CLAMAV_PORT" "3310")"
        t clamavDisableHint
    else
        E_CLAMAV_ENABLED="false"
        E_CLAMAV_SOCKET="" E_CLAMAV_HOST="" E_CLAMAV_PORT="3310"
        t clamavSkipped
    fi

    # ─────────────────────────────────────────────────────────────────────────
    # Section 7 — MCP
    # ─────────────────────────────────────────────────────────────────────────

    section_header 7 $TOTAL_SECTIONS "MCP"
    local enable_mcp
    enable_mcp="$(ask_yes_no "$(t mcpEnable)" "true")"

    if [ "$enable_mcp" = "true" ]; then
        E_MCP_ENABLED="true"
        t mcpDisableHint
    else
        E_MCP_ENABLED="false"
        t mcpSkipped
    fi

    E_MCP_HASH_SECRET="$(gen_hex 32)"
    echo "  MCP_HASH_SECRET . ${#E_MCP_HASH_SECRET} hex chars"

    # ─────────────────────────────────────────────────────────────────────────
    # Section 8 — Security Keys (auto-generated)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 8 $TOTAL_SECTIONS "Security Keys"
    E_KEY_TK="$(gen_b64url 48)"
    E_KEV="$(gen_hex 32)"
    E_KIV="$(gen_hex 16)"
    E_SESSION_SECRET="$(gen_b64url 48)"
    E_SESSION_MAX_AGE="10800000"
    E_CSRF_SECRET="$(gen_b64url 48)"
    E_API_KEY="$(gen_hex 32)"

    t secKeysGenerated
    echo "  KEY_TK .......... ${#E_KEY_TK} chars"
    echo "  KEV ............. ${#E_KEV} hex chars (32 bytes AES-256)"
    echo "  KIV ............. ${#E_KIV} hex chars (16 bytes AES IV)"
    echo "  SESSION_SECRET .. ${#E_SESSION_SECRET} chars"
    echo "  CSRF_SECRET ..... ${#E_CSRF_SECRET} chars"
    echo "  API_KEY ......... ${#E_API_KEY} hex chars"

    # ─────────────────────────────────────────────────────────────────────────
    # Section 9 — Helmet / Trust Proxy (defaults)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 9 $TOTAL_SECTIONS "Helmet / Trust Proxy"
    E_HELMET_STRICT_TRANSPORT="false"
    E_TRUST_PROXY="false"
    t defaultsInfo
    t helmetInfo
    t trustProxyInfo

    # ─────────────────────────────────────────────────────────────────────────
    # Section 10 — Logs (defaults)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 10 $TOTAL_SECTIONS "Logs"
    E_LOG_RETENTION_APP="7"
    E_LOG_RETENTION_API="14"
    E_LOG_RETENTION_ERROR="30"
    E_LOG_RETENTION_AUDIT="90"
    E_LOG_TO_CONSOLE="true"
    t defaultsInfo
    t logsRetention
    t logsConsole

    # ─────────────────────────────────────────────────────────────────────────
    # Section 11 — Rate Limiting (defaults)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 11 $TOTAL_SECTIONS "Rate Limiting"
    E_RATE_LIMIT_FORM_MAX="30"
    E_RATE_LIMIT_FORM_WINDOW_MS="60000"
    E_MAX_FAILED_LOGIN_ATTEMPTS="10"
    t defaultsInfo
    t rateInfo

    # ─────────────────────────────────────────────────────────────────────────
    # Section 12 — Upload Limits (defaults)
    # ─────────────────────────────────────────────────────────────────────────

    section_header 12 $TOTAL_SECTIONS "Upload Limits"
    E_API_MAX_FILE_SIZE="10485760"
    E_API_MAX_TOTAL_SIZE="52428800"
    E_API_MAX_FILES="10"
    E_API_MAX_FIELDS="40"
    E_API_MAX_FIELD_SIZE="10000"
    t defaultsInfo
    t uploadInfo

    # ── Write .env ────────────────────────────────────────────────────────────

    write_env > "$ENV_PATH"

    echo ""
    t successCreated
}

# ─── Run ──────────────────────────────────────────────────────────────────────

main "$@"
