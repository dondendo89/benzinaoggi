import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface PriceNotification {
  distributorId: number;
  impiantoId: number;
  distributor: any;
  fuelType: string;
  baseFuelType: string;
  isSelfService: boolean;
  oldPrice: number;
  newPrice: number;
  direction: 'up' | 'down';
  delta: number;
  percentage: number;
}

// Custom JSON.stringify replacer to handle BigInt
function replacer(key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

async function sendTelegramMessage(chatId: number | bigint, text: string, options: any = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options
    };

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload, replacer) // Use the replacer here
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error(`Telegram API error for chatId ${chatId}:`, {
        error_code: result.error_code,
        description: result.description,
        parameters: result.parameters
      });
      
      // Se l'utente ha bloccato il bot o la chat non esiste più
      if (result.error_code === 403 || result.error_code === 400) {
        console.log(`Deactivating user with chatId ${chatId} due to error ${result.error_code}`);
        // Disattiva l'utente
        await prisma.telegramUser.update({
          where: { chatId: typeof chatId === 'bigint' ? chatId : BigInt(chatId) },
          data: { isActive: false }
        }).catch((updateError) => {
          console.error('Error deactivating user:', updateError);
        });
      }
    } else {
      console.log(`Telegram message sent successfully to chatId ${chatId}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}

function formatPriceNotification(notification: PriceNotification): string {
  const { distributor, baseFuelType, oldPrice, newPrice, delta, isSelfService } = notification;
  
  const name = distributor?.gestore || distributor?.bandiera || distributor?.comune || `Impianto ${notification.impiantoId}`;
  const location = [distributor?.indirizzo, distributor?.comune].filter(Boolean).join(', ');
  const serviceType = isSelfService ? ' (Self)' : '';
  const direction = notification.direction === 'down' ? '📉' : '📈';
  const deltaFormatted = Math.abs(delta).toFixed(3);
  const percentageFormatted = Math.abs(notification.percentage).toFixed(1);
  
  let emoji = '⛽';
  if (baseFuelType.toLowerCase().includes('benzina')) emoji = '⛽';
  else if (baseFuelType.toLowerCase().includes('gasolio') || baseFuelType.toLowerCase().includes('diesel')) emoji = '🚛';
  else if (baseFuelType.toLowerCase().includes('gpl')) emoji = '🔥';
  else if (baseFuelType.toLowerCase().includes('metano')) emoji = '💨';

  const title = notification.direction === 'down' ? 
    `${emoji} <b>Prezzo ${baseFuelType} in ribasso!</b> ${direction}` :
    `${emoji} <b>Prezzo ${baseFuelType} aumentato</b> ${direction}`;

  return `${title}

🏪 <b>${name}</b>
📍 ${location}
⛽ ${baseFuelType}${serviceType}

💰 <b>€${oldPrice.toFixed(3)} → €${newPrice.toFixed(3)}</b>
📊 Variazione: €${deltaFormatted} (${percentageFormatted}%)

🌐 Vedi dettagli: https://www.benzinaoggi.it`;
}

function formatDailyPricesUpdate(distributors: any[], city?: string): string {
  const locationText = city ? ` a ${city}` : '';
  let message = `📊 <b>Aggiornamento prezzi${locationText}</b>\n\n`;
  
  distributors.slice(0, 10).forEach((dist, index) => {
    message += `<b>${index + 1}. ${dist.bandiera || 'Distributore'}</b>\n`;
    message += `📍 ${dist.indirizzo || ''}, ${dist.comune || ''}\n`;
    
    if (dist.prices?.length) {
      const sortedPrices = dist.prices.sort((a: any, b: any) => a.price - b.price);
      sortedPrices.slice(0, 3).forEach((price: any) => {
        const service = price.isSelfService ? ' (Self)' : '';
        message += `⛽ ${price.fuelType}${service}: <b>€${price.price.toFixed(3)}</b>\n`;
      });
    }
    
    message += '\n';
  });
  
  message += `🔍 Tutti i prezzi su: https://www.benzinaoggi.it`;
  
  return message;
}

export async function POST(req: NextRequest) {
  try {
    // Verifica autorizzazione
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.API_SECRET;
    
    if (!expectedToken || !authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { type, data } = body;

    let sent = 0;
    let errors = 0;
    const messages: any[] = [];

    if (type === 'price_drop' && data?.notifications) {
      // Notifiche per ribassi di prezzo
      const notifications: PriceNotification[] = data.notifications;
      
      for (const notification of notifications) {
        try {
          // Trova tutti gli utenti interessati a questa notifica
          const subscribers = await prisma.telegramUser.findMany({
            where: {
              isActive: true,
              subscriptions: {
                some: {
                  isActive: true,
                  OR: [
                    { type: 'ALL' },
                    { 
                      type: 'STATION',
                      impiantoId: notification.impiantoId,
                      fuelType: notification.baseFuelType
                    },
                    {
                      type: 'CITY',
                      city: notification.distributor?.comune
                    }
                  ]
                }
              }
            }
          });

          const messageText = formatPriceNotification(notification);
          
          for (const subscriber of subscribers) {
            const result = await sendTelegramMessage(subscriber.chatId, messageText);
            
            if (result?.ok) {
              sent++;
            } else {
              errors++;
            }
            
            // Pausa breve per evitare rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          if (subscribers.length > 0) {
            messages.push({
              notification: `${notification.baseFuelType} @ ${notification.distributor?.bandiera}`,
              subscribers: subscribers.length,
              message: messageText.substring(0, 100) + '...'
            });
          }
          
        } catch (error) {
          console.error('Error processing notification:', error);
          errors++;
        }
      }
    }
    
    else if (type === 'daily_update' && data?.distributors) {
      // Aggiornamento prezzi giornaliero
      const distributors = data.distributors;
      const city = data.city;
      
      try {
        // Trova utenti iscritti agli aggiornamenti giornalieri
        const subscribers = await prisma.telegramUser.findMany({
          where: {
            isActive: true,
            subscriptions: {
              some: {
                isActive: true,
                type: 'DAILY_UPDATE'
              }
            }
          }
        });

        if (subscribers.length > 0) {
          const messageText = formatDailyPricesUpdate(distributors, city);
          
          for (const subscriber of subscribers) {
            const result = await sendTelegramMessage(subscriber.chatId, messageText);
            
            if (result?.ok) {
              sent++;
            } else {
              errors++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          messages.push({
            type: 'daily_update',
            subscribers: subscribers.length,
            distributors_count: distributors.length
          });
        }
        
      } catch (error) {
        console.error('Error sending daily update:', error);
        errors++;
      }
    }
    
    else {
      return NextResponse.json({ 
        error: 'Invalid notification type or missing data' 
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      sent,
      errors,
      messages,
      type
    });

  } catch (error) {
    console.error('Error processing Telegram notifications:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET per testare le notifiche
export async function GET(req: NextRequest) {
  try {
    // Conta utenti attivi e iscrizioni
    const activeUsers = await prisma.telegramUser.count({
      where: { isActive: true }
    });
    
    const activeSubscriptions = await prisma.telegramSubscription.count({
      where: { isActive: true }
    });
    
    const subscriptionsByType = await prisma.telegramSubscription.groupBy({
      by: ['type'],
      where: { isActive: true },
      _count: { type: true }
    });

    return NextResponse.json({
      ok: true,
      stats: {
        active_users: activeUsers,
        active_subscriptions: activeSubscriptions,
        subscriptions_by_type: subscriptionsByType
      },
      endpoints: {
        send_notification: {
          method: 'POST',
          url: `${req.nextUrl.origin}/api/telegram/notify`,
          headers: { 'Authorization': 'Bearer YOUR_API_SECRET' },
          body_example: {
            type: 'price_drop',
            data: {
              notifications: [
                {
                  distributorId: 123,
                  impiantoId: 8284,
                  distributor: { bandiera: 'Test', comune: 'Roma' },
                  fuelType: 'Benzina',
                  baseFuelType: 'Benzina',
                  isSelfService: false,
                  oldPrice: 1.650,
                  newPrice: 1.640,
                  direction: 'down',
                  delta: -0.010,
                  percentage: -0.6
                }
              ]
            }
          }
        }
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Error fetching stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
