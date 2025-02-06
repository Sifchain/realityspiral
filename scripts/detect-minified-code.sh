#!/bin/bash

echo "Scanning for potential minified JS/TS code..."

# We'll look in .ts, .tsx, .js, .jsx files, skipping common build dirs.
FILES=$(find . \
  \( -name 'node_modules' -prune \) -o \
  \( -name 'dist' -prune \) -o \
  \( -name 'build' -prune \) -o \
  -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
  -print)

if [ -z "$FILES" ]; then
  echo "No relevant JS/TS files found."
  exit 0
fi

THRESHOLD=1000
VIOLATIONS=0

for file in $FILES; do
  # First check if file has the ignore comment in first 3 lines
  if head -n 3 "$file" | grep -q "@minified-ignore-file"; then
    echo "Skipping $file (file-level ignore found)"
    continue
  fi

  # Use awk to check line lengths, but ignore lines that have @minified-ignore
  RESULTS=$(awk -v threshold=$THRESHOLD '
    length($0) >= threshold && !/.*@minified-ignore.*/ { 
      print NR ":" $0 
    }
  ' "$file" || true)
  
  if [ -n "$RESULTS" ]; then
    # We have potential minified lines
    while IFS= read -r match; do
      # 'match' will be something like "1234:the entire matched line"
      LINENUM=$(echo "$match" | cut -d: -f1)
      echo "::error file='$file:$LINENUM' Detected potential minified code (≥ $THRESHOLD chars)."
    done <<< "$RESULTS"
    VIOLATIONS=1
  fi
done

if [ "$VIOLATIONS" -eq 1 ]; then
  echo "ERROR: Minified code detected. Please remove or exclude it."
  echo "Tip: Add '@minified-ignore' comment before long lines that should be ignored."
  echo "     Or add '@minified-ignore-file' at the top of the file to ignore the entire file."
  exit 1
else
  echo "No minified code detected."
fi 