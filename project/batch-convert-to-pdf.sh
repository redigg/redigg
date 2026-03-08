#!/bin/bash

cd /root/.openclaw/workspace/groups/redigg-group/project

# Function to convert markdown to pdf
convert_to_pdf() {
    local md_file="$1"
    local pdf_file="${md_file%.md}.pdf"
    
    echo "Converting $md_file to $pdf_file..."
    
    # Convert markdown to html first
    pandoc -s "$md_file" -o "${md_file%.md}.html" --metadata title="$(basename "$md_file" .md)" 2>/dev/null
    
    # Convert html to pdf
    wkhtmltopdf "${md_file%.md}.html" "$pdf_file" 2>/dev/null
    
    if [ -f "$pdf_file" ]; then
        echo "✅ Successfully converted: $pdf_file"
        # Clean up html file
        rm -f "${md_file%.md}.html"
    else
        echo "❌ Failed to convert: $md_file"
    fi
}

# Convert market research rounds 1-10
echo "=== Converting market research rounds ==="
for i in {1..10}; do
    file="redigg-market-research-round${i}.md"
    if [ -f "$file" ]; then
        convert_to_pdf "$file"
    else
        echo "⚠️ File not found: $file"
    fi
done

# Convert core product design files
echo -e "\n=== Converting core product design files ==="
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
        convert_to_pdf "$file"
    else
        echo "⚠️ File not found: $file"
    fi
done

echo -e "\n✅ Batch conversion complete!"
ls -la *.pdf
