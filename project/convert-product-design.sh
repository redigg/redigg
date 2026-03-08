#!/bin/bash

cd /root/.openclaw/workspace/groups/redigg-group/project

# Function to convert markdown to pdf with xelatex
convert_with_xelatex() {
    local md_file="$1"
    local pdf_file="${md_file%.md}.pdf"
    
    echo "Converting $md_file to $pdf_file with xelatex..."
    
    # Try with xelatex
    pandoc -s "$md_file" -o "$pdf_file" \
        --pdf-engine=xelatex \
        -V CJKmainfont="Noto Sans CJK SC" \
        --metadata title="$(basename "$md_file" .md)" 2>&1
    
    if [ -f "$pdf_file" ]; then
        echo "✅ Successfully converted: $pdf_file"
    else
        echo "⚠️ xelatex failed, trying html + wkhtmltopdf..."
        # Fallback to html + wkhtmltopdf
        pandoc -s "$md_file" -o "${md_file%.md}.html" --metadata title="$(basename "$md_file" .md)" 2>/dev/null
        wkhtmltopdf "${md_file%.md}.html" "$pdf_file" 2>/dev/null
        rm -f "${md_file%.md}.html"
        if [ -f "$pdf_file" ]; then
            echo "✅ Successfully converted (fallback): $pdf_file"
        else
            echo "❌ Failed to convert: $md_file"
        fi
    fi
}

# Convert core product design files
echo "=== Converting core product design files ==="
core_files=(
    "phase1-detailed-plan.md"
    "updated-execution-plan.md"
    "focused-execution-plan.md"
    "future-work-priorities.md"
    "redigg-vs-independent-research-tools.md"
    "skill-md-v1-draft.md"
)

for file in "${core_files[@]}"; do
    if [ -f "$file" ]; then
        convert_with_xelatex "$file"
    else
        echo "⚠️ File not found: $file"
    fi
done

echo -e "\n✅ Product design conversion complete!"
ls -la *.pdf | grep -E "(phase|execution|future|redigg-vs|skill-md)"
