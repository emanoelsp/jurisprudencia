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
  const wordHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml>
  <![endif]-->
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
    h1, h2, h3 { font-family: Arial, sans-serif; }
    p { margin-bottom: 8pt; text-align: justify; }
    blockquote { margin-left: 40pt; }
  </style>
</head>
<body>
  <h2 style="font-family:Arial;font-size:11pt;border-bottom:1pt solid #000;padding-bottom:6pt;">
    IURISPRUDENTIA — Parecer Jurídico
  </h2>
  <p style="font-family:Arial;font-size:9pt;color:#666;">
    ${title} · Gerado em ${new Date().toLocaleDateString('pt-BR')}
  </p>
  <br>
  ${html}
  <br><hr>
  <p style="font-family:Arial;font-size:8pt;color:#999;text-align:center;">
    Documento gerado por IURISPRUDENTIA. As sugestões são de apoio à decisão. A responsabilidade profissional é do advogado.
  </p>
</body>
</html>`

  const blob = new Blob(['﻿', wordHtml], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')}_parecer.doc`
  a.click()
  URL.revokeObjectURL(url)
}
