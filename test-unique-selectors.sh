#!/bin/bash

# Unique Selector Generation Test
# Test the extension's ability to generate unique selectors for duplicate elements

set -e
cd "$(dirname "$0")"

echo "🎯 Unique Selector Generation Test"
echo "=================================="

echo "📄 Unique selector test page available at:"
echo "   file://$(pwd)/unique-selector-test.html"
echo ""

echo "🧪 Testing Instructions:"
echo "========================"
echo ""
echo "1. RELOAD THE EXTENSION:"
echo "   - Go to chrome://extensions/"
echo "   - Find 'Universal Element Locator'"
echo "   - Click the reload button (circular arrow)"
echo ""
echo "2. OPEN THE UNIQUE SELECTOR TEST PAGE:"
echo "   - Open a new tab"
echo "   - Navigate to: file://$(pwd)/unique-selector-test.html"
echo "   - You should see a page with 14 buttons all having data-test-id='action-menu-button'"
echo ""
echo "3. SCAN THE PAGE:"
echo "   - Click the Universal Element Locator extension icon"
echo "   - Click 'Scan Page Elements'"
echo "   - All 14 action buttons should be highlighted"
echo ""
echo "4. VIEW RESULTS:"
echo "   - Click 'View Scanned Results'"
echo "   - Search for 'action-menu-button' in the results table"
echo "   - You should see multiple entries for the same data-test-id"
echo ""
echo "🔍 What to Look For:"
echo "==================="
echo ""
echo "✅ ENHANCED LOCATOR GENERATION:"
echo "   - Each action-menu-button element should have multiple locator options"
echo "   - Basic selector: [data-test-id=\"action-menu-button\"]"
echo "   - Contextual selectors with parent context"
echo "   - Table row context: table tr:nth-child(N) [data-test-id=\"action-menu-button\"]"
echo "   - Card context: .user-card [data-test-id=\"action-menu-button\"]"
echo "   - Form context: #form-id [data-test-id=\"action-menu-button\"]"
echo ""
echo "✅ UNIQUENESS INDICATORS:"
echo "   - isUnique: false (for the basic selector)"
echo "   - isUnique: true (for contextual selectors that are unique)"
echo "   - uniquenessLevel: 'non-unique', 'contextual', etc."
echo "   - contextType: 'parent-id', 'parent-class', 'nth-child', 'table-row'"
echo ""
echo "✅ DIFFERENT CONTEXT TYPES TO FIND:"
echo "   - Table context selectors (5 buttons in table rows)"
echo "   - Card context selectors (4 buttons in user cards)"
echo "   - Form context selectors (5 buttons in different forms)"
echo "   - Parent ID context (for elements with parent IDs)"
echo "   - nth-child context (for positional uniqueness)"
echo ""
echo "✅ SPECIFIC EXAMPLES TO VERIFY:"
echo "   1. Button in first table row:"
echo "      - Basic: [data-test-id=\"action-menu-button\"]"
echo "      - Context: #users-table tr:nth-child(1) [data-test-id=\"action-menu-button\"]"
echo "      - User ID: [data-user-id=\"1\"]"
echo ""
echo "   2. Button in user card:"
echo "      - Basic: [data-test-id=\"action-menu-button\"]"
echo "      - Context: .user-card [data-test-id=\"action-menu-button\"]"
echo "      - Card specific: [data-card-id=\"1\"] [data-test-id=\"action-menu-button\"]"
echo ""
echo "   3. Button in form:"
echo "      - Basic: [data-test-id=\"action-menu-button\"]"
echo "      - Context: #user-settings-form [data-test-id=\"action-menu-button\"]"
echo "      - Section: [data-section=\"profile\"]"
echo ""
echo "❌ BEFORE THE FIX (PROBLEMS):"
echo "   - Only basic [data-test-id=\"action-menu-button\"] selector"
echo "   - No indication of uniqueness level"
echo "   - No contextual selectors to distinguish elements"
echo "   - Difficult to target specific action buttons"
echo ""
echo "🔧 Debugging Tips:"
echo "=================="
echo "   - Look for 'isUnique' property in locator objects"
echo "   - Check 'uniquenessLevel' and 'contextType' properties"
echo "   - Verify multiple locator options per element"
echo "   - Test contextual selectors in browser console"
echo ""
echo "🚀 Success Criteria:"
echo "==================="
echo "   ✅ Each action-menu-button has 3-5 different locator options"
echo "   ✅ Basic selector marked as 'non-unique'"
echo "   ✅ Contextual selectors provide unique targeting"
echo "   ✅ Different context types for different parent structures"
echo "   ✅ Table, card, and form contexts properly identified"
echo "   ✅ Additional data attributes (user-id, section) captured"
echo ""
echo "📊 Expected Locator Breakdown Per Button:"
echo "========================================"
echo "   1. Basic data-test-id selector (non-unique)"
echo "   2. Parent ID context (if parent has ID)"
echo "   3. Parent class context (if parent has meaningful class)"
echo "   4. nth-child context (positional)"
echo "   5. Table/form specific context (if applicable)"
echo "   6. Additional data attributes (user-id, section, etc.)"
echo ""
echo "Ready to test unique selector generation! 🎯"
