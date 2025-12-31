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
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          color: #374151; 
          line-height: 1.5; 
          margin: 0; 
          padding: 0;
          background-color: #f3f4f6;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f3f4f6;
          padding-bottom: 40px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff;
          border-radius: 16px;
          margin-top: 40px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);
          padding: 40px 20px; 
          text-align: center; 
          color: white;
        }
        .logo {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
          border-radius: 16px;
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .header p {
          margin: 8px 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 32px 24px;
        }
        .card { 
          background: #f9fafb; 
          padding: 24px; 
          border-radius: 12px; 
          margin-bottom: 24px; 
          border: 1px solid #f3f4f6;
        }
        .card h2 {
          margin-top: 0;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 16px;
        }
        .metric-row { 
          display: block;
          margin-bottom: 16px; 
          background: white;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .metric-label { 
          font-size: 12px;
          font-weight: 600; 
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 4px;
        }
        .metric-value { 
          font-size: 20px;
          font-weight: 800; 
          color: #111827;
        }
        .tag-table { width: 100%; border-collapse: collapse; }
        .tag-item-row td { 
          padding: 12px 0; 
          border-bottom: 1px solid #e5e7eb; 
        }
        .tag-item-row:last-child td { border-bottom: none; }
        .tag-name { font-weight: 600; color: #4b5563; }
        .tag-count-cell { text-align: right; }
        .tag-count { 
          background: #e5e7eb; 
          color: #4b5563; 
          padding: 2px 10px; 
          border-radius: 20px; 
          font-size: 12px; 
          font-weight: 700;
          display: inline-block;
        }
        .footer { 
          text-align: center; 
          font-size: 13px; 
          color: #9ca3af; 
          margin-top: 20px; 
          padding: 0 20px;
        }
        .cta-container {
          text-align: center;
          margin-top: 8px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);
          color: white !important;
          padding: 14px 28px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 10px 30px -5px rgba(30, 64, 175, 0.3);
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
