#!/bin/bash

echo "=== DGS Scheduler Testing Scenarios ==="
echo

echo "1. Testing with current real date:"
node server/utils/test-scheduler.js | tail -n 20

echo
echo "2. Testing with January 15th, 2024 (Monday morning):"
TEST_CURRENT_DATE="2024-01-15T10:00:00Z" node server/utils/test-scheduler.js | tail -n 20

echo
echo "3. Testing with February 29th, 2024 (leap year edge case):"
TEST_CURRENT_DATE="2024-02-29T10:00:00Z" node server/utils/test-scheduler.js | tail -n 20

echo
echo "4. Testing with January 31st, 2024 (month-end edge case):"
TEST_CURRENT_DATE="2024-01-31T10:00:00Z" node server/utils/test-scheduler.js | tail -n 20

echo
echo "=== Testing complete! ==="
echo
echo "You can also test manually with:"
echo "TEST_CURRENT_DATE=\"2024-01-15T10:00:00Z\" node server/utils/test-scheduler.js"
