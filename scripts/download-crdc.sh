#!/usr/bin/env bash
# Download CRDC (Civil Rights Data Collection) 2020-21 California state file
# Source: https://eddataexpress.ed.gov/resources/reports-and-files/crdc-state-files/2020-2021

set -euo pipefail

DEST_DIR="raw-data/crdc"
mkdir -p "$DEST_DIR"

# California CRDC 2020-21 state file
URL="https://eddataexpress.ed.gov/sites/default/files/data_files/CRDC_2020-21_CA.xlsx"
DEST="$DEST_DIR/CRDC_2020-21_CA.xlsx"

if [ -f "$DEST" ]; then
  echo "Already downloaded: $DEST"
else
  echo "Downloading CRDC 2020-21 California..."
  curl -k -L -o "$DEST" "$URL"
  echo "Saved to $DEST"
fi

# Appendix workbook (column definitions)
APPENDIX_URL="https://eddataexpress.ed.gov/sites/default/files/resource_data_files/2020-21%20Appendix%20Workbook%20%284%29.xlsx"
APPENDIX_DEST="$DEST_DIR/2020-21_Appendix_Workbook.xlsx"

if [ -f "$APPENDIX_DEST" ]; then
  echo "Already downloaded: $APPENDIX_DEST"
else
  echo "Downloading CRDC Appendix Workbook..."
  curl -k -L -o "$APPENDIX_DEST" "$APPENDIX_URL"
  echo "Saved to $APPENDIX_DEST"
fi

echo "Done."
