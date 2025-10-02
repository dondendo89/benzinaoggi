import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ 
      error: 'TELEGRAM_BOT_TOKEN not configured in environment variables' 
    }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'set';

    if (action === 'set') {
      // Configura il webhook
      const webhookUrl = `${req.nextUrl.origin}/api/telegram/webhook`;
      
      const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true
        })
      });

      const result = await response.json();

      if (result.ok) {
        return NextResponse.json({
          success: true,
          message: 'Webhook configurato con successo',
          webhook_url: webhookUrl,
          result: result.result
        });
      } else {
        return NextResponse.json({
          error: 'Errore nella configurazione del webhook',
          details: result
        }, { status: 400 });
      }
    } 
    
    else if (action === 'delete') {
      // Rimuovi il webhook
      const response = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: true })
      });

      const result = await response.json();

      return NextResponse.json({
        success: result.ok,
        message: result.ok ? 'Webhook rimosso' : 'Errore nella rimozione',
        result: result.result
      });
    }
    
    else {
      return NextResponse.json({
        error: 'Azione non valida. Usa "set" o "delete"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error setting up Telegram webhook:', error);
    return NextResponse.json({
      error: 'Errore interno del server',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET per ottenere informazioni sul webhook attuale
export async function GET(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ 
      error: 'TELEGRAM_BOT_TOKEN not configured' 
    }, { status: 500 });
  }

  try {
    // Ottieni informazioni sul bot
    const botResponse = await fetch(`${TELEGRAM_API_URL}/getMe`);
    const botInfo = await botResponse.json();

    // Ottieni informazioni sul webhook
    const webhookResponse = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const webhookInfo = await webhookResponse.json();

    const currentWebhookUrl = `${req.nextUrl.origin}/api/telegram/webhook`;

    return NextResponse.json({
      bot_info: botInfo.result,
      webhook_info: webhookInfo.result,
      expected_webhook_url: currentWebhookUrl,
      webhook_configured: webhookInfo.result?.url === currentWebhookUrl,
      setup_instructions: {
        set_webhook: {
          method: 'POST',
          url: `${req.nextUrl.origin}/api/telegram/setup`,
          body: { action: 'set' }
        },
        delete_webhook: {
          method: 'POST', 
          url: `${req.nextUrl.origin}/api/telegram/setup`,
          body: { action: 'delete' }
        }
      }
    });
  } catch (error) {
    console.error('Error getting Telegram info:', error);
    return NextResponse.json({
      error: 'Errore nel recupero delle informazioni',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
