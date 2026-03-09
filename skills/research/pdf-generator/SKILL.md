# PDF Generator (LaTeX)

Generate high-quality PDF documents from text or markdown using LaTeX.
This skill creates a `.tex` file and compiles it to PDF.

## Dependencies
- `pdflatex` must be installed on the system (e.g., via TeX Live or MacTeX).
- Node.js `child_process` to run the command.

## Usage
Provide the `content` (markdown or plain text) and a `title`.
The skill will:
1. Convert the content to LaTeX format (using a template).
2. Write the `.tex` file.
3. Run `pdflatex` to generate the PDF.
4. Return the path to the generated PDF.
