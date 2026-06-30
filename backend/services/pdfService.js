const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const pdfDir = path.join(__dirname, '../static/pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

function generatePDF(reportId, reportMarkdown) {
  return new Promise((resolve, reject) => {
    const filename = `report-${reportId}.pdf`;
    const filepath = path.join(pdfDir, filename);
    const doc = new PDFDocument({ margin: 50 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Styling Colors
    const primaryColor = '#d97706'; // Safety Amber
    const textColor = '#1e293b'; // Dark Slate
    const secondaryColor = '#475569'; // Slate Grey

    // Safety Banner
    doc.rect(0, 0, doc.page.width, 20).fill(primaryColor);
    doc.moveDown(2);

    // Title / Header
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .fontSize(18)
       .text('CROWNRIDGE LLP', { align: 'center' });
    
    doc.fillColor(textColor)
       .fontSize(14)
       .text('SAFETY INCIDENT REPORT DESK', { align: 'center' })
       .moveDown(1.5);

    // Separator line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .strokeColor('#cbd5e1')
       .lineWidth(1)
       .stroke()
       .moveDown(1.5);

    // Parse and render markdown
    const lines = reportMarkdown.split('\n');

    for (let line of lines) {
      line = line.trim();
      if (!line) {
        doc.moveDown(0.5);
        continue;
      }

      // Check headers
      if (line.startsWith('# CROWNRIDGE LLP') || (line.startsWith('# ') && line.includes('REPORT'))) {
        // Skip main title since we already have a nice header
        continue;
      } else if (line.startsWith('## ')) {
        const text = line.replace('## ', '');
        doc.fillColor(primaryColor)
           .font('Helvetica-Bold')
           .fontSize(12)
           .text(text)
           .moveDown(0.5);
      } else if (line.startsWith('### ')) {
        const text = line.replace('### ', '');
        doc.fillColor(textColor)
           .font('Helvetica-Bold')
           .fontSize(11)
           .text(text)
           .moveDown(0.5);
      } else if (line.startsWith('- **') || line.startsWith('* **') || line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet list
        let text = line.replace(/^[-*]\s+/, '');
        
        // Handle bold markdown e.g. **Report Reference:**
        let isBoldPrefix = false;
        let prefix = '';
        let rest = text;

        if (text.startsWith('**')) {
          const match = text.match(/^\*\*(.*?)\*\*(.*)/);
          if (match) {
            isBoldPrefix = true;
            prefix = match[1];
            rest = match[2];
          }
        }

        doc.fillColor(textColor).fontSize(10);
        
        if (isBoldPrefix) {
          doc.font('Helvetica-Bold').text('  • ' + prefix, { continued: true })
             .font('Helvetica').text(rest);
        } else {
          doc.font('Helvetica').text('  • ' + text);
        }
        doc.moveDown(0.3);
      } else {
        // Standard body text. Handle blockquotes or alerts
        if (line.startsWith('>')) {
          line = line.replace(/^>\s*/, '');
          doc.fillColor(secondaryColor)
             .font('Helvetica-Oblique')
             .fontSize(10)
             .text(line, { indent: 15 })
             .moveDown(0.5);
        } else {
          // Standard text
          doc.fillColor(textColor)
             .font('Helvetica')
             .fontSize(10)
             .text(line, { align: 'justify', lineGap: 2 })
             .moveDown(0.5);
        }
      }
    }

    // Footer
    doc.fillColor(secondaryColor)
       .font('Helvetica')
       .fontSize(8)
       .text(`Crownridge LLP Compliance Safety Document • Generated Automatically`, 50, doc.page.height - 50, {
         align: 'center'
       });

    doc.end();

    stream.on('finish', () => {
      logger.info(`PDF file created successfully at ${filepath}`);
      resolve(filename);
    });

    stream.on('error', (err) => {
      logger.error(`Error writing PDF file at ${filepath}`, err);
      reject(err);
    });
  });
}

function deletePDF(filename) {
  if (!filename) return;
  const filepath = path.join(pdfDir, filename);
  if (fs.existsSync(filepath)) {
    try {
      fs.unlinkSync(filepath);
      logger.info(`PDF file deleted successfully: ${filename}`);
    } catch (err) {
      logger.error(`Failed to delete PDF file: ${filename}`, err);
    }
  }
}

module.exports = {
  generatePDF,
  deletePDF
};
