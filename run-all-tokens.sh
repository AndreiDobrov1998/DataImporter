#!/bin/bash

# Array of tokens
tokens=(
    "EAAAlzO0G03v4okLkKV_2CEJ0iGRe-IADeoIH8QNvB5tgau5e5Kq9fJAIe6Ogd3M"
    "EAAAlwZKM5rVujmtzDrTqo5IlcycCw83zpnol_KokpowwCfAj0M7KxyUqEspy9_L"
    "EAAAl85WNer1GRtK5DYMWg5xmx1GNXy950wrz3HU0z_McBCWL1KYvOGGP3a2TCkE"
)

# Default parameters
MIN_QUANTITY=2
MAX_QUANTITY=5
CONCURRENCY=10

# Function to run the order generator
run_order_generator() {
    local token=$1
    local index=$2
    echo "Running with token $index..."
    npx ts-node src/scripts/order-data-generator.ts \
        --min-quantity $MIN_QUANTITY \
        --max-quantity $MAX_QUANTITY \
        --concurrency $CONCURRENCY \
        --access-token "$token"
}

# Main execution
echo "Starting order generation with ${#tokens[@]} tokens..."
echo "Parameters: min-quantity=$MIN_QUANTITY, max-quantity=$MAX_QUANTITY, concurrency=$CONCURRENCY"
echo "----------------------------------------"

# Iterate through tokens
for i in "${!tokens[@]}"; do
    run_order_generator "${tokens[$i]}" $((i + 1))
    echo "----------------------------------------"
done

echo "All tokens processed!" 