import PDFDocument from 'pdfkit';

export interface PdfRenderOptions {
  title?: string;
  author?: string;
  generatedAt?: Date;
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'numbered_list'; items: string[] }
  | { type: 'references'; items: string[] };

interface DocumentSection {
  level: number;
  title: string;
  blocks: Block[];
}

export interface ParsedAcademicDocument {
  title: string;
  sections: DocumentSection[];
  abstractText?: string;
  referenceItems: string[];
  wordCount: number;
}

const ACADEMIC_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

export function normalizePdfSourceContent(title: string | undefined, rawContent: string): string {
  let content = rawContent.replace(/\r\n/g, '\n').trim();

  const firstHeadingIndex = content.search(/^#\s+/m);
  if (firstHeadingIndex > 0) {
    content = content.slice(firstHeadingIndex).trim();
  }

  content = replaceSourcesSection(content);
  content = stripSectionByTitle(content, 'Review Summary');
  content = stripSectionByTitle(content, 'Sources');
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  if (!/^#\s+/m.test(content)) {
    const fallbackTitle = (title || 'Research Report').trim();
    content = `# ${fallbackTitle}\n\n${content}`;
  }

  return content;
}

export function parseAcademicMarkdown(title: string | undefined, rawContent: string): ParsedAcademicDocument {
  const normalized = normalizePdfSourceContent(title, rawContent);
  const lines = normalized.split('\n');
  const sections: DocumentSection[] = [];
  const referenceItems: string[] = [];
  let documentTitle = (title || 'Research Report').trim();
  let currentSection: DocumentSection | null = null;
  let paragraphLines: string[] = [];
  let currentListType: 'bullet' | 'numbered' | null = null;
  let currentListItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      paragraphLines = [];
      return;
    }

    ensureSection();
    currentSection!.blocks.push({ type: 'paragraph', text });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!currentListType || currentListItems.length === 0) {
      currentListType = null;
      currentListItems = [];
      return;
    }

    ensureSection();
    if ((currentSection?.title || '').toLowerCase() === 'references') {
      currentSection!.blocks.push({ type: 'references', items: [...currentListItems] });
      referenceItems.push(...currentListItems);
    } else {
      currentSection!.blocks.push({
        type: currentListType === 'bullet' ? 'bullet_list' : 'numbered_list',
        items: [...currentListItems]
      });
    }

    currentListType = null;
    currentListItems = [];
  };

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = {
        level: 2,
        title: 'Introduction',
        blocks: []
      };
      sections.push(currentSection);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const headingText = sanitizeInlineMarkdown(headingMatch[2]);
      if (level === 1) {
        documentTitle = headingText || documentTitle;
        currentSection = null;
      } else {
        currentSection = { level, title: headingText, blocks: [] };
        sections.push(currentSection);
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      const item = sanitizeInlineMarkdown(bulletMatch[1]);
      if (currentListType !== 'bullet') {
        flushList();
        currentListType = 'bullet';
      }
      currentListItems.push(item);
      continue;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      const item = sanitizeInlineMarkdown(numberedMatch[1]);
      if (currentListType !== 'numbered') {
        flushList();
        currentListType = 'numbered';
      }
      currentListItems.push(item);
      continue;
    }

    flushList();
    paragraphLines.push(sanitizeInlineMarkdown(line));
  }

  flushParagraph();
  flushList();

  const abstractSection = sections.find((section) => section.title.toLowerCase() === 'abstract');
  const abstractText = abstractSection
    ? abstractSection.blocks
        .filter((block): block is Extract<Block, { type: 'paragraph' }> => block.type === 'paragraph')
        .map((block) => block.text)
        .join(' ')
        .trim()
    : undefined;

  const filteredSections = sections.filter((section) => section.title.toLowerCase() !== 'abstract');
  const dedupedReferences = referenceItems.length > 0
    ? Array.from(new Set(referenceItems.map((item) => item.trim()).filter(Boolean)))
    : [];

  return {
    title: documentTitle,
    sections: filteredSections,
    abstractText,
    referenceItems: dedupedReferences,
    wordCount: countWords(normalized)
  };
}

export function renderAcademicPdf(
  doc: PDFKit.PDFDocument,
  parsed: ParsedAcademicDocument,
  options: PdfRenderOptions = {}
): void {
  const title = parsed.title || options.title || 'Research Report';
  const author = options.author || 'Redigg AI';
  const generatedAt = options.generatedAt || new Date();
  const sectionCounters = [0, 0, 0];

  doc.info.Title = title;
  doc.info.Author = author;
  doc.info.Subject = 'Scientific survey report';
  doc.info.Keywords = parsed.sections.map((section) => section.title).join(', ');
  doc.info.Creator = 'Redigg PDF Generator';
  doc.info.Producer = 'Redigg PDF Generator';

  renderTitlePage(doc, title, author, generatedAt, parsed);
  doc.addPage();

  for (const section of parsed.sections) {
    if (section.title.toLowerCase() === 'references') {
      renderReferencesSection(doc, section, parsed.referenceItems);
      continue;
    }

    const heading = buildSectionHeading(section, sectionCounters);
    renderSectionHeading(doc, heading, section.level);

    for (const block of section.blocks) {
      renderBlock(doc, block);
    }
  }

  if (!parsed.sections.some((section) => section.title.toLowerCase() === 'references') && parsed.referenceItems.length > 0) {
    renderReferencesSection(doc, { level: 2, title: 'References', blocks: [] }, parsed.referenceItems);
  }

  decorateBufferedPages(doc, title);
}

function renderTitlePage(
  doc: PDFKit.PDFDocument,
  title: string,
  author: string,
  generatedAt: Date,
  parsed: ParsedAcademicDocument
): void {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.font('Times-Bold').fontSize(24).text(title, doc.page.margins.left, 90, {
    width: pageWidth,
    align: 'center'
  });
  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(12).fillColor('#555555').text('Redigg AI Research', {
    width: pageWidth,
    align: 'center'
  });
  doc.moveDown(0.2);
  doc.text(ACADEMIC_DATE_FORMATTER.format(generatedAt), {
    width: pageWidth,
    align: 'center'
  });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111').text('Abstract', {
    width: pageWidth
  });
  doc.moveDown(0.3);
  doc.font('Times-Roman').fontSize(11.5).fillColor('#111111').text(
    parsed.abstractText || 'This report provides a structured survey based on the generated research workflow.',
    {
      width: pageWidth,
      align: 'justify',
      lineGap: 4
    }
  );

  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').fontSize(12).text('Document Metadata');
  doc.moveDown(0.4);
  doc.font('Times-Roman').fontSize(11).text(`Author: ${author}`);
  doc.text(`Generated: ${ACADEMIC_DATE_FORMATTER.format(generatedAt)}`);
  doc.text(`Sections: ${parsed.sections.filter((section) => section.title.toLowerCase() !== 'references').length}`);
  doc.text(`References: ${parsed.referenceItems.length}`);
  doc.text(`Word Count: ${parsed.wordCount}`);

  const topLevelSections = parsed.sections
    .filter((section) => section.level === 2 && section.title.toLowerCase() !== 'references')
    .map((section) => section.title);

  if (topLevelSections.length > 0) {
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(12).text('Included Sections');
    doc.moveDown(0.4);
    doc.font('Times-Roman').fontSize(11);
    for (const sectionTitle of topLevelSections) {
      doc.text(`• ${sectionTitle}`, {
        width: pageWidth,
        indent: 12
      });
    }
  }
}

function buildSectionHeading(section: DocumentSection, counters: number[]): string {
  const lowerTitle = section.title.toLowerCase();
  if (lowerTitle === 'references') {
    return 'References';
  }

  if (section.level === 2) {
    counters[0] += 1;
    counters[1] = 0;
    counters[2] = 0;
    return `${counters[0]} ${section.title}`;
  }

  if (section.level === 3) {
    if (counters[0] === 0) counters[0] = 1;
    counters[1] += 1;
    counters[2] = 0;
    return `${counters[0]}.${counters[1]} ${section.title}`;
  }

  return section.title;
}

function renderSectionHeading(doc: PDFKit.PDFDocument, heading: string, level: number): void {
  const height = level === 2 ? 28 : 22;
  ensureSpace(doc, height + 28);

  doc.moveDown(level === 2 ? 1.1 : 0.6);
  doc.font('Helvetica-Bold')
    .fontSize(level === 2 ? 18 : 14)
    .fillColor('#111111')
    .text(heading, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right
    });
  doc.moveDown(0.35);
}

function renderBlock(doc: PDFKit.PDFDocument, block: Block): void {
  switch (block.type) {
    case 'paragraph':
      ensureSpace(doc, 42);
      doc.font('Times-Roman').fontSize(11.5).fillColor('#111111').text(block.text, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'justify',
        lineGap: 4,
        paragraphGap: 10
      });
      break;
    case 'bullet_list':
      renderList(doc, block.items, 'bullet');
      break;
    case 'numbered_list':
      renderList(doc, block.items, 'numbered');
      break;
    case 'references':
      renderReferences(doc, block.items);
      break;
  }
}

function renderReferencesSection(
  doc: PDFKit.PDFDocument,
  section: DocumentSection,
  fallbackReferences: string[]
): void {
  renderSectionHeading(doc, 'References', section.level);
  const referencesFromBlocks = section.blocks
    .flatMap((block) => block.type === 'references' ? block.items : []);
  const references = referencesFromBlocks.length > 0 ? referencesFromBlocks : fallbackReferences;
  renderReferences(doc, references);
}

function renderList(doc: PDFKit.PDFDocument, items: string[], kind: 'bullet' | 'numbered'): void {
  for (const [index, item] of items.entries()) {
    ensureSpace(doc, 22);
    const marker = kind === 'bullet' ? '•' : `${index + 1}.`;
    const x = doc.page.margins.left + 10;
    const y = doc.y;

    doc.font('Times-Roman').fontSize(11.5).fillColor('#111111');
    doc.text(marker, x, y, { continued: false });
    doc.text(item, x + 18, y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 28,
      align: 'left',
      lineGap: 3
    });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.2);
}

function renderReferences(doc: PDFKit.PDFDocument, items: string[]): void {
  const references = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  for (const [index, item] of references.entries()) {
    ensureSpace(doc, 28);
    const rendered = item.replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');
    const x = doc.page.margins.left + 6;
    const y = doc.y;
    doc.font('Times-Roman').fontSize(10.8).fillColor('#111111');
    doc.text(`${index + 1}.`, x, y);
    doc.text(rendered, x + 20, y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 30,
      align: 'left',
      lineGap: 3
    });
    doc.moveDown(0.1);
  }
}

function decorateBufferedPages(doc: PDFKit.PDFDocument, title: string): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    const pageLabel = index + 1;
    const shortTitle = title.length > 80 ? `${title.slice(0, 77)}...` : title;
    const footerY = doc.page.height - doc.page.margins.bottom - 14;

    if (index > 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#666666').text(shortTitle, doc.page.margins.left, 34, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'right',
        lineBreak: false
      });
      doc.moveTo(doc.page.margins.left, 50)
        .lineTo(doc.page.width - doc.page.margins.right, 50)
        .lineWidth(0.6)
        .strokeColor('#D9D9D9')
        .stroke();
    }

    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(
      String(pageLabel),
      doc.page.margins.left,
      footerY,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
        lineBreak: false
      }
    );
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight > bottomLimit) {
    doc.addPage();
  }
}

function sanitizeInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

function replaceSourcesSection(content: string): string {
  return content
    .replace(/\*\*Selected Sources:\*\*/gi, '## References')
    .replace(/\*\*Sources:\*\*/gi, '## References')
    .replace(/^Selected Sources:\s*$/gim, '## References')
    .replace(/^Sources:\s*$/gim, '## References');
}

function stripSectionByTitle(content: string, title: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.*)$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim().toLowerCase();
      if (heading === title.toLowerCase()) {
        skipping = true;
        continue;
      }
      if (skipping) {
        skipping = false;
      }
    }

    if (!skipping) {
      output.push(line);
    }
  }

  return output.join('\n');
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}
