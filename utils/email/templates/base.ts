export function wrapInBaseTemplate(
  content: string,
  title: string,
  previewText: string = "Your Moodly Update",
  footerText: string = "You're receiving this because you enabled updates in your Moodly settings.",
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Figtree:wght@400;600;700&display=swap');
        body { 
          font-family: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          color: #1b1622; 
          line-height: 1.5; 
          margin: 0; 
          padding: 0;
          background-color: #fdf3e4;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #fdf3e4;
          padding-bottom: 40px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff;
          border-radius: 24px;
          margin-top: 40px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(27, 22, 34, 0.05), 0 8px 24px -12px rgba(27, 22, 34, 0.12);
        }
        .header { 
          background-color: #f2a93b;
          padding: 40px 20px; 
          text-align: center; 
          color: #2a1a05;
        }
        .logo {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
          border-radius: 16px;
        }
        .header h1 { 
          margin: 0; 
          font-family: 'Bricolage Grotesque', 'Figtree', -apple-system, 'Segoe UI', Arial, sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .header p {
          margin: 8px 0 0;
          opacity: 0.8;
          font-size: 16px;
        }
        .content {
          padding: 32px 24px;
        }
        .card { 
          background: #f5f3f7; 
          padding: 24px; 
          border-radius: 24px; 
          margin-bottom: 24px; 
        }
        .card h2 {
          margin-top: 0;
          font-family: 'Bricolage Grotesque', 'Figtree', -apple-system, 'Segoe UI', Arial, sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #1b1622;
          margin-bottom: 16px;
        }
        .metric-row { 
          display: block;
          margin-bottom: 12px; 
          background: #ffffff;
          padding: 12px 16px;
          border-radius: 16px;
        }
        .metric-label { 
          font-size: 11px;
          font-weight: 600; 
          color: #6f6878;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: block;
          margin-bottom: 4px;
        }
        .metric-value { 
          font-family: 'Bricolage Grotesque', 'Figtree', -apple-system, 'Segoe UI', Arial, sans-serif;
          font-size: 22px;
          font-weight: 800; 
          color: #1b1622;
        }
        .tag-table { width: 100%; border-collapse: collapse; }
        .tag-item-row td { 
          padding: 12px 0; 
          border-bottom: 1px solid rgba(27, 22, 34, 0.09); 
        }
        .tag-item-row:last-child td { border-bottom: none; }
        .tag-name { font-weight: 600; color: #1b1622; }
        .tag-count-cell { text-align: right; }
        .tag-count { 
          background: #fceedb; 
          color: #1b1622; 
          padding: 2px 10px; 
          border-radius: 999px; 
          font-size: 12px; 
          font-weight: 700;
          display: inline-block;
        }
        .footer { 
          text-align: center; 
          font-size: 13px; 
          color: #a39cad; 
          margin-top: 20px; 
          padding: 0 20px;
        }
        .cta-container {
          text-align: center;
          margin-top: 8px;
        }
        .button {
          display: inline-block;
          background: #f2a93b;
          color: #2a1a05 !important;
          padding: 14px 28px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <img src="https://tanguyhardion.github.io/moodly/logo.png" alt="Moodly Logo" class="logo">
            <h1>${title}</h1>
            <p>${previewText}</p>
          </div>

          <div class="content">
            ${content}

            <div class="cta-container">
              <a href="https://tanguyhardion.github.io/moodly" class="button">Open Moodly</a>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>${footerText}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
