#!/bin/bash

DESTINATION_DIR="./lib/lambda-functions/db_migration"

rm "$DESTINATION_DIR/alembic.ini"
rm "$DESTINATION_DIR/database.py"
rm "$DESTINATION_DIR/models.py"
rm -rf "$DESTINATION_DIR/migrations"

cp "./alembic.ini" "$DESTINATION_DIR/alembic.ini"
cp "./src/database.py" "$DESTINATION_DIR/database.py"
cp "./src/models.py" "$DESTINATION_DIR/models.py"
cp -r "./migrations" "$DESTINATION_DIR/migrations"

echo "Migration files copied to $DESTINATION_DIR"
