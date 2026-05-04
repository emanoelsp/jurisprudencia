// Export de pareceres para PDF (via print) e Word (.doc via HTML blob)

function buildPrintHtml(html: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Crimson Pro', Georgia, serif;
      font-size: 13pt;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }
    .page {
      max-width: 180mm;
      margin: 0 auto;
      padding: 25mm 0;
    }
    .header {
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 11pt;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #1a1a1a;
    }
    .header p {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 9pt;
      color: #555;
      margin-top: 4px;
    }
    .content h1, .content h2, .content h3 {
      font-family: 'Inter', Arial, sans-serif;
      font-weight: 600;
      margin: 20px 0 8px;
    }
    .content h1 { font-size: 15pt; }
    .content h2 { font-size: 13pt; }
    .content h3 { font-size: 12pt; }
    .content p { margin-bottom: 10px; text-align: justify; }
    .content ul, .content ol { padding-left: 20px; margin-bottom: 10px; }
    .content li { margin-bottom: 4px; }
    .content strong { font-weight: 600; }
    .content em { font-style: italic; }
    .content blockquote {
      border-left: 3px solid #999;
      padding-left: 16px;
      color: #444;
      margin: 12px 0;
    }
    .footer {
      border-top: 1px solid #ccc;
      margin-top: 32px;
      padding-top: 10px;
      font-family: 'Inter', Arial, sans-serif;
      font-size: 8pt;
      color: #888;
      text-align: center;
    }
    @page { margin: 20mm 25mm; size: A4; }
    @media print {
      body { padding: 0; }
      .page { max-width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>IURISPRUDENTIA — Parecer Jurídico</h1>
      <p>${title} · Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>
    <div class="content">${html}</div>
    <div class="footer">
      Documento gerado por IURISPRUDENTIA · As sugestões são de apoio à decisão. A responsabilidade profissional é do advogado.
    </div>
  </div>
</body>
</html>`
}

export function exportToPdf(html: string, title: string): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(buildPrintHtml(html, title))
  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
  }
}

export function exportToWord(html: string, title: string): void {
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Word Open XML namespace — opens natively in Word 2007+ and LibreOffice
  const wordHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <!--[if gte mso 9]><xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml><![endif]-->
  <style>
    @page Section1 {
      size: 210mm 297mm;
      margin: 30mm 25mm 25mm 35mm; /* ABNT NBR 14724 */
      mso-page-orientation: portrait;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
    }
    .doc-header {
      border-bottom: 2pt solid #000;
      padding-bottom: 8pt;
      margin-bottom: 18pt;
    }
    .doc-header h1 {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #000;
      margin: 0 0 4pt 0;
    }
    .doc-header p {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #555;
      margin: 0;
    }
    .doc-content h1 { font-family: Arial, sans-serif; font-size: 14pt; font-weight: bold; margin: 18pt 0 6pt; }
    .doc-content h2 { font-family: Arial, sans-serif; font-size: 12pt; font-weight: bold; margin: 14pt 0 5pt; }
    .doc-content h3 { font-family: Arial, sans-serif; font-size: 12pt; font-weight: bold; font-style: italic; margin: 12pt 0 4pt; }
    .doc-content p { margin-bottom: 8pt; text-align: justify; orphans: 2; widows: 2; }
    .doc-content ul, .doc-content ol { padding-left: 24pt; margin-bottom: 8pt; }
    .doc-content li { margin-bottom: 3pt; text-align: justify; }
    .doc-content strong { font-weight: bold; }
    .doc-content em { font-style: italic; }
    .doc-content blockquote {
      margin: 10pt 0 10pt 40pt;
      padding-left: 12pt;
      border-left: 3pt solid #aaa;
      font-size: 11pt;
      color: #333;
    }
    .doc-footer {
      border-top: 1pt solid #ccc;
      margin-top: 24pt;
      padding-top: 8pt;
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
<div class="Section1">
  <div class="doc-header">
    <h1>IURISPRUDENTIA — Parecer Jurídico</h1>
    <p>${safeTitle} &bull; Gerado em ${date}</p>
  </div>
  <div class="doc-content">${html}</div>
  <div class="doc-footer">
    Documento gerado por IURISPRUDENTIA com assistência de inteligência artificial.<br>
    As sugestões são de apoio à decisão. A responsabilidade profissional é integralmente do advogado subscritor.
  </div>
</div>
</body>
</html>`

  const blob = new Blob(['﻿', wordHtml], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}_parecer.docx`
  a.click()
  URL.revokeObjectURL(url)
}
