#!/bin/bash
set -e
cd ~ || exit

echo "Setting Up Bench..."

pip install frappe-bench
bench -v init frappe-bench --skip-assets --python "$(which python)"
cd ./frappe-bench || exit

bench -v setup requirements

echo "Setting Up Gameplan App..."
bench get-app gameplan "${GITHUB_WORKSPACE}"

echo "Setting Up Procfile..."

sed -i 's/^watch:/# watch:/g' Procfile
sed -i 's/^schedule:/# schedule:/g' Procfile

echo "Setting up redisearch module..."
echo "loadmodule ${GITHUB_WORKSPACE}/.github/helper/redisearch.so" >> ./config/redis_cache.conf
chmod +x "${GITHUB_WORKSPACE}/.github/helper/redisearch.so"
cat ./config/redis_cache.conf

echo "Starting Bench..."

bench start &> bench_start.log &

CI=Yes bench build &
build_pid=$!

echo "Creating SQLite Site..."
# SQLite is a serverless backend, so no database server/credentials are needed.
# Redirect stdin from /dev/null so an unexpected interactive prompt fails fast
# (and prints the prompt to the log) instead of hanging until the job times out.
bench new-site gameplan.test \
	--db-type sqlite \
	--admin-password admin \
	--force \
	--verbose </dev/null

# Test/runtime flags that the MariaDB site gets from .github/helper/site_config.json.
# Set them with --parse so they are stored as native JSON types (booleans), not strings.
bench --site gameplan.test set-config --parse allow_tests true
bench --site gameplan.test set-config --parse enable_ui_tests true
bench --site gameplan.test set-config --parse server_script_enabled true
bench --site gameplan.test set-config --parse mute_emails true
bench --site gameplan.test set-config --parse ignore_csrf 1

echo "Installing Gameplan app..."
bench --site gameplan.test install-app gameplan

echo "Building search index..."
bench --site gameplan.test execute gameplan.search_sqlite.build_index

# wait till assets are built succesfully
wait $build_pid
