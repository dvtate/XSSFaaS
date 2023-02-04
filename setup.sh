#!/bin/bash
# On error, stop
set -e

# Get source code
# git clone https://github.com/dvtate/xssfaas
# cd xssfaas

# Verify that dependent packages are installed
command -v mysql >/dev/null 2>&1 || { echo >&2 "mysql is required but not installed.  Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo >&2 "nodejs is required but not installed.  Aborting."; exit 1; }
# TODO check for yarn or other compatible alternative
command -v npm >/dev/null 2>&1 || { echo >&2 "npm is required but not installed.  Aborting."; exit 1; }

# Get db creds
read -p "Enter mysql host (ie - localhost): " db_host
read -p "Enter mysql username: " db_user
read -p "Enter mysql password: " -s db_pass
read -p "Enter your domain (ie - localhost): " domain

# Initialize database
mysql -uroot -ppassword < api/db.sql


# Return random alpha-numeric string of given LENGTH
#
# Usage: VALUE=$(rand-str $LENGTH)
#    or: VALUE=$(rand-str)
function rand-str {

    local DEFAULT_LENGTH=64
    local LENGTH=${1:-$DEFAULT_LENGTH}

    LC_ALL=C tr -dc A-Za-z0-9 </dev/urandom | head -c $LENGTH
    # LC_ALL=C: required for Mac OS X - https://unix.stackexchange.com/a/363194/403075
    # -dc: delete complementary set == delete all except given set
}


# Generate .env file for api server
echo "
# Listen on this port
PORT=8431

# For communication with router server (if needed)
INTERNAL_PORT=5890

## Database credentials
# host: uri for datbase server
# user: username for database user
# password: password for database user
# database: database to use
RO_DB = '{\"host\":\"$db_host\",\"user\":\"$db_user\",\"password\":\"$db_pass\",\"database\":\"xssaas\"}'
RW_DB = '{\"host\":\"$db_host\",\"user\":\"$db_user\",\"password\":\"$db_pass\",\"database\":\"xssaas\"}'

PW_SALT='$(rand-str 64)'

# Uncomment to prevent tracking IP addresses and user-agent strings of workers
# Note: This may break some features of the router
#NO_TELEMETRY=1

UPLOADS_DIR=$HOME/.xssaas/uploads

# SSL credentials
#SSL_CERT=/etc/letsencrypt/live/$domain/fullchain.pem
#SSL_KEY=/etc/letsencrypt/live/$domain/privkey.pem

DEBUG=xss:api:*
" > api/.env
echo "Generated $(realpath api/.env). Please verify that it is correct"

# Generate .env file for router server
echo "
# Websocket server will listen on this port
WS_PORT=6333

# For communication with api server (if needed)
INTERNAL_PORT=5890

## Database credentials
# host: uri for datbase server
# user: username for database user
# password: password for database user
# database: database to use
RO_DB = '{\"host\":\"$db_host\",\"user\":\"$db_user\",\"password\":\"$db_pass\",\"database\":\"xssaas\"}'
RW_DB = '{\"host\":\"$db_host\",\"user\":\"$db_user\",\"password\":\"$db_pass\",\"database\":\"xssaas\"}'

# SSL credentials
SSL_CERT=/etc/letsencrypt/live/$domain/fullchain.pem
SSL_KEY=/etc/letsencrypt/live/$domain/privkey.pem
" > router/.env
echo "Generated $(realpath router/.env). Please verify that it is correct"

# Install npm dependencies
echo "Installing NPM dependencies..."
cd api
npm install
cd ../router
npm install
cd ../frontend
npm install
echo "Installed NPM dependencies."

# Build typecript and webpack
echo "Building frontend..."
npm run build
echo "Built frontend."
echo "Building backend TypeScript..."
cd ../api
npm run build
cd ../router
npm run build
cd ..
echo "Built backend TypeScript."


echo "Everything installed successfully! Here are some next steps:
- Take a look at the .env files to make sure they're correct.
- Install pm2 and use the ecosystem.config.js files for the api server and router"