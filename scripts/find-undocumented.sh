#!/bin/bash
#
# Documentation Audit Script
#
# Finds files missing documentation and common issues
#
# Usage: bash scripts/find-undocumented.sh
#

echo "🔍 Searching for documentation issues..."
echo ""

# Find TypeScript files without header comments
echo "📄 Files without file header comments:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -L "^\s*\/\*\*" src/**/*.ts 2>/dev/null | head -20
echo ""

# Find console.log statements
echo "🪵 Files with console.log (should use console.info/warn/error):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -r "console\.log" src/ --include="*.ts" | wc -l
echo "Total console.log statements found"
echo ""

# Find debug logs
echo "🐛 Debug statements to remove:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "console\.log.*\(here\|test\|debug\|temp\)" src/ --include="*.ts" 2>/dev/null || echo "None found ✅"
echo ""

# Find TODO comments
echo "📝 TODO comments:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "//\s*TODO" src/ --include="*.ts" 2>/dev/null | head -10
echo ""

# Find FIXME comments
echo "🔧 FIXME comments:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -rn "//\s*FIXME" src/ --include="*.ts" 2>/dev/null | head -10
echo ""

# Find functions without JSDoc
echo "📋 Functions potentially missing JSDoc:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "(Manual review recommended)"
grep -rn "^export.*function\|^async function\|^function" src/ --include="*.ts" | wc -l
echo "Total functions found"
echo ""

echo "✨ Audit complete!"
echo ""
echo "Next steps:"
echo "1. Review DOCUMENTATION_STYLE_GUIDE.md for standards"
echo "2. Use DOCUMENTATION_CHECKLIST.md to track progress"
echo "3. Reference network.ts and data-loader.ts as examples"
