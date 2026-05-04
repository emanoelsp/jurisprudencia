// E-mail transacional via Resend
// Requer RESEND_API_KEY e RESEND_FROM no .env.local

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM || 'IURISPRUDENTIA <noreply@iurisprudentia.com.br>'

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurado — e-mail não enviado.')
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend error:', err)
    }
  } catch (err) {
    console.error('[email] send failed:', err)
  }
}

export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  const firstName = name?.split(' ')[0] || 'Advogado(a)'
  await send(
    to,
    'Bem-vindo(a) à IURISPRUDENTIA',
    `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;background:#161b27;border-radius:16px 16px 0 0;border:1px solid #2a3347;border-bottom:none;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#e8d5b0;letter-spacing:-0.5px;">
            IURIS<span style="color:#6366f1;">PRUDENTIA</span>
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#6b7a99;text-transform:uppercase;letter-spacing:2px;">Inteligência Jurídica</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;background:#161b27;border:1px solid #2a3347;border-top:none;border-bottom:none;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f0ead6;">
            Olá, ${firstName}! 👋
          </h1>
          <p style="margin:0 0 16px;font-size:15px;color:#8892a4;line-height:1.6;">
            Sua conta na <strong style="color:#e8d5b0;">IURISPRUDENTIA</strong> está ativa. Você agora tem acesso à análise jurídica assistida por IA — jurisprudência, CF/88 e Código Penal em segundos.
          </p>

          <div style="background:#0d1117;border:1px solid #2a3347;border-radius:12px;padding:24px;margin:24px 0;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#6b7a99;text-transform:uppercase;letter-spacing:1px;">Como começar</p>
            ${[
              ['1', 'Crie um processo', 'Vá em Processos → Novo Processo e faça upload do PDF da peça.'],
              ['2', 'Analise com IA', 'Clique em "Analisar com IURISPRUDENTIA" e aguarde os resultados.'],
              ['3', 'Revise e aprove', 'Insira as sugestões no editor, ajuste e aprove o parecer final.'],
            ].map(([n, t, d]) => `
            <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;">
              <span style="min-width:24px;height:24px;border-radius:50%;background:#6366f1;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${n}</span>
              <div>
                <p style="margin:0;font-size:14px;font-weight:600;color:#e8d5b0;">${t}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#8892a4;">${d}</p>
              </div>
            </div>`).join('')}
          </div>

          <a href="https://iurisprudentia.vercel.app/dashboard" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
            Acessar plataforma →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#0d1117;border:1px solid #2a3347;border-top:none;border-radius:0 0 16px 16px;">
          <p style="margin:0;font-size:11px;color:#4a5568;text-align:center;">
            IURISPRUDENTIA · Análise jurídica com IA para advogados brasileiros<br>
            Caso não reconheça este cadastro, ignore este e-mail.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  )
}
