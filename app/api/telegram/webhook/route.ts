import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

// Tipi Telegram
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  location?: TelegramLocation;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramLocation {
  longitude: number;
  latitude: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

// Configurazione Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Funzioni helper per API Telegram
async function sendMessage(chatId: number, text: string, options: any = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}

async function sendLocation(chatId: number, lat: number, lon: number, title?: string) {
  if (!TELEGRAM_BOT_TOKEN) return null;

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendVenue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        latitude: lat,
        longitude: lon,
        title: title || 'Distributore',
        address: 'Clicca per vedere i dettagli'
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error sending Telegram location:', error);
    return null;
  }
}

// Gestione comandi bot
async function handleCommand(message: TelegramMessage) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || '';
  const command = text.split(' ')[0].toLowerCase();

  // Salva/aggiorna utente nel database
  await saveUser(message.from, chatId);

  switch (command) {
    case '/start':
      return handleStartCommand(chatId, userId, message.from);
    
    case '/subscribe':
    case '/iscriviti':
      return handleSubscribeCommand(chatId, userId, text);
    
    case '/unsubscribe':
    case '/disiscriviti':
      return handleUnsubscribeCommand(chatId, userId);
    
    case '/prezzi':
      return handlePricesCommand(chatId, text);
    
    case '/cerca':
      return handleSearchCommand(chatId, text);
    
    case '/help':
    case '/aiuto':
      return handleHelpCommand(chatId);
    
    case '/status':
      return handleStatusCommand(chatId, userId);
    
    default:
      return handleUnknownCommand(chatId);
  }
}

async function saveUser(user: TelegramUser, chatId: number) {
  try {
    await prisma.telegramUser.upsert({
      where: { telegramId: user.id },
      update: {
        chatId,
        firstName: user.first_name,
        lastName: user.last_name || null,
        username: user.username || null,
        languageCode: user.language_code || null,
        isActive: true,
        lastActivity: new Date()
      },
      create: {
        telegramId: user.id,
        chatId,
        firstName: user.first_name,
        lastName: user.last_name || null,
        username: user.username || null,
        languageCode: user.language_code || null,
        isActive: true,
        lastActivity: new Date()
      }
    });
  } catch (error) {
    console.error('Error saving Telegram user:', error);
  }
}

async function handleStartCommand(chatId: number, userId: number, user: TelegramUser) {
  const welcomeText = `
🚗 <b>Benvenuto in BenzinaOggi Bot!</b>

Ciao ${user.first_name}! Sono il bot ufficiale di BenzinaOggi.it 🚗

<b>Cosa posso fare per te:</b>
🔔 Inviarti notifiche sui ribassi dei prezzi
📍 Cercare distributori vicini a te
💰 Mostrarti i prezzi aggiornati in tempo reale
📊 Fornirti statistiche sui prezzi

<b>Comandi disponibili:</b>
/subscribe - Iscriviti alle notifiche prezzi
/prezzi [città] - Mostra prezzi in una città
/cerca [località] - Cerca distributori
/status - Vedi le tue iscrizioni
/help - Mostra tutti i comandi

<b>Per iniziare:</b>
1. Usa /subscribe per iscriverti alle notifiche
2. Invia la tua posizione per trovare distributori vicini
3. Usa /prezzi [città] per vedere i prezzi

Visita anche il nostro sito: https://www.benzinaoggi.it
`;

  return sendMessage(chatId, welcomeText, {
    reply_markup: {
      keyboard: [
        [{ text: '🔔 Iscriviti alle notifiche', callback_data: 'subscribe' }],
        [{ text: '📍 Invia posizione', request_location: true }],
        [{ text: '💰 Prezzi oggi', callback_data: 'prices_today' }],
        [{ text: '❓ Aiuto', callback_data: 'help' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

async function handleSubscribeCommand(chatId: number, userId: number, text: string) {
  // Estrai parametri dal comando: /subscribe [impianto_id] [carburante]
  const parts = text.split(' ');
  
  if (parts.length === 1) {
    // Nessun parametro - mostra opzioni generali
    const subscribeText = `
🔔 <b>Iscrizione Notifiche</b>

Scegli il tipo di notifiche che vuoi ricevere:

<b>Opzioni disponibili:</b>
• <code>/subscribe all</code> - Tutte le notifiche ribassi
• <code>/subscribe [città]</code> - Solo ribassi in una città
• <code>/subscribe [impianto_id] [carburante]</code> - Distributore specifico

<b>Esempi:</b>
• <code>/subscribe all</code>
• <code>/subscribe Roma</code>
• <code>/subscribe 8284 Benzina</code>

Quale preferisci?
`;

    return sendMessage(chatId, subscribeText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌍 Tutte le notifiche', callback_data: 'sub_all' }],
          [{ text: '🏙️ Solo la mia città', callback_data: 'sub_city' }],
          [{ text: '⛽ Distributore specifico', callback_data: 'sub_station' }]
        ]
      }
    });
  }

  if (parts[1] === 'all') {
    // Iscrizione a tutte le notifiche
    try {
      await prisma.telegramSubscription.upsert({
        where: {
          telegramId_type: {
            telegramId: userId,
            type: 'ALL'
          }
        },
        update: { isActive: true },
        create: {
          telegramId: userId,
          type: 'ALL',
          isActive: true
        }
      });

      return sendMessage(chatId, `
✅ <b>Iscrizione completata!</b>

Riceverai notifiche per tutti i ribassi di prezzo in Italia.

Usa /status per vedere le tue iscrizioni attive.
`);
    } catch (error) {
      return sendMessage(chatId, '❌ Errore durante l\'iscrizione. Riprova più tardi.');
    }
  }

  // Altri tipi di iscrizione...
  return sendMessage(chatId, 'Funzionalità in sviluppo. Usa <code>/subscribe all</code> per ora.');
}

async function handleUnsubscribeCommand(chatId: number, userId: number) {
  try {
    const result = await prisma.telegramSubscription.updateMany({
      where: { telegramId: userId },
      data: { isActive: false }
    });

    if (result.count > 0) {
      return sendMessage(chatId, `
✅ <b>Disiscrizione completata!</b>

Non riceverai più notifiche sui prezzi.

Puoi sempre riiscriverti con /subscribe
`);
    } else {
      return sendMessage(chatId, 'Non risulti iscritto a nessuna notifica.');
    }
  } catch (error) {
    return sendMessage(chatId, '❌ Errore durante la disiscrizione. Riprova più tardi.');
  }
}

async function handlePricesCommand(chatId: number, text: string) {
  const parts = text.split(' ');
  const city = parts.slice(1).join(' ') || 'Roma'; // Default Roma

  try {
    // Chiama l'API esistente per ottenere i distributori
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://benzinaoggi.vercel.app'}/api/distributors?city=${encodeURIComponent(city)}&limit=10`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.ok || !data.distributors?.length) {
      return sendMessage(chatId, `❌ Nessun distributore trovato per "${city}"`);
    }

    const distributors = data.distributors.slice(0, 5); // Primi 5 risultati
    
    let pricesText = `💰 <b>Prezzi a ${city}</b>\n\n`;
    
    distributors.forEach((dist: any, index: number) => {
      pricesText += `<b>${index + 1}. ${dist.bandiera || 'Distributore'}</b>\n`;
      pricesText += `📍 ${dist.indirizzo || ''}, ${dist.comune || ''}\n`;
      
      if (dist.prices?.length) {
        dist.prices.forEach((price: any) => {
          const service = price.isSelfService ? ' (Self)' : '';
          pricesText += `⛽ ${price.fuelType}${service}: <b>€${price.price.toFixed(3)}</b>\n`;
        });
      }
      
      pricesText += '\n';
    });

    pricesText += `🔍 Vedi tutti i risultati su: https://www.benzinaoggi.it`;

    return sendMessage(chatId, pricesText);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return sendMessage(chatId, '❌ Errore nel recupero dei prezzi. Riprova più tardi.');
  }
}

async function handleSearchCommand(chatId: number, text: string) {
  const query = text.replace('/cerca', '').trim();
  
  if (!query) {
    return sendMessage(chatId, `
🔍 <b>Ricerca Distributori</b>

Usa: <code>/cerca [località]</code>

<b>Esempi:</b>
• <code>/cerca Roma</code>
• <code>/cerca Milano centro</code>
• <code>/cerca 00100</code>

Oppure invia la tua posizione per cercare distributori vicini.
`, {
      reply_markup: {
        keyboard: [
          [{ text: '📍 Invia la mia posizione', request_location: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  return handlePricesCommand(chatId, `/prezzi ${query}`);
}

async function handleStatusCommand(chatId: number, userId: number) {
  try {
    const subscriptions = await prisma.telegramSubscription.findMany({
      where: { 
        telegramId: userId,
        isActive: true
      }
    });

    if (subscriptions.length === 0) {
      return sendMessage(chatId, `
📊 <b>Le tue iscrizioni</b>

❌ Non hai iscrizioni attive.

Usa /subscribe per iscriverti alle notifiche sui prezzi.
`);
    }

    let statusText = '📊 <b>Le tue iscrizioni attive:</b>\n\n';
    
    subscriptions.forEach((sub, index) => {
      statusText += `${index + 1}. `;
      
      switch (sub.type) {
        case 'ALL':
          statusText += '🌍 Tutte le notifiche ribassi\n';
          break;
        case 'CITY':
          statusText += `🏙️ Città: ${sub.city || 'Non specificata'}\n`;
          break;
        case 'STATION':
          statusText += `⛽ Distributore ${sub.impiantoId} - ${sub.fuelType}\n`;
          break;
        default:
          statusText += `📝 ${sub.type}\n`;
      }
    });

    statusText += '\nUsa /unsubscribe per disiscriverti da tutte le notifiche.';

    return sendMessage(chatId, statusText);
  } catch (error) {
    return sendMessage(chatId, '❌ Errore nel recupero dello status. Riprova più tardi.');
  }
}

async function handleHelpCommand(chatId: number) {
  const helpText = `
❓ <b>Comandi disponibili</b>

<b>Notifiche:</b>
/subscribe - Iscriviti alle notifiche
/unsubscribe - Disiscriviti dalle notifiche
/status - Vedi le tue iscrizioni

<b>Prezzi e Ricerca:</b>
/prezzi [città] - Mostra prezzi in una città
/cerca [località] - Cerca distributori
📍 Invia posizione - Trova distributori vicini

<b>Altro:</b>
/help - Mostra questo messaggio
/start - Messaggio di benvenuto

<b>Esempi pratici:</b>
• <code>/prezzi Roma</code>
• <code>/cerca Milano</code>
• <code>/subscribe all</code>

🌐 Sito web: https://www.benzinaoggi.it
`;

  return sendMessage(chatId, helpText);
}

async function handleUnknownCommand(chatId: number) {
  return sendMessage(chatId, `
❓ Comando non riconosciuto.

Usa /help per vedere tutti i comandi disponibili.
`);
}

// Gestione posizione
async function handleLocation(message: TelegramMessage) {
  if (!message.location) return;

  const { latitude, longitude } = message.location;
  const chatId = message.chat.id;

  try {
    // Cerca distributori vicini usando l'API esistente
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://benzinaoggi.vercel.app'}/api/distributors?lat=${latitude}&lon=${longitude}&radiusKm=10&limit=5`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.ok || !data.distributors?.length) {
      return sendMessage(chatId, '❌ Nessun distributore trovato nelle vicinanze (raggio 10km)');
    }

    let locationText = `📍 <b>Distributori vicini a te</b>\n\n`;
    
    data.distributors.forEach((dist: any, index: number) => {
      const distance = dist.distance ? ` (${dist.distance.toFixed(1)} km)` : '';
      locationText += `<b>${index + 1}. ${dist.bandiera || 'Distributore'}</b>${distance}\n`;
      locationText += `📍 ${dist.indirizzo || ''}, ${dist.comune || ''}\n`;
      
      if (dist.prices?.length) {
        const bestPrice = dist.prices.reduce((min: any, price: any) => 
          !min || price.price < min.price ? price : min
        );
        locationText += `⛽ Miglior prezzo: ${bestPrice.fuelType} €${bestPrice.price.toFixed(3)}\n`;
      }
      
      locationText += '\n';
    });

    await sendMessage(chatId, locationText);

    // Invia anche la posizione del distributore più vicino
    const nearest = data.distributors[0];
    if (nearest.latitudine && nearest.longitudine) {
      await sendLocation(
        chatId, 
        nearest.latitudine, 
        nearest.longitudine, 
        `${nearest.bandiera || 'Distributore'} - ${nearest.comune}`
      );
    }

  } catch (error) {
    console.error('Error handling location:', error);
    return sendMessage(chatId, '❌ Errore nella ricerca per posizione. Riprova più tardi.');
  }
}

// Handler principale webhook
export async function POST(req: NextRequest) {
  try {
    // Verifica token di sicurezza (opzionale ma consigliato)
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    if (expectedToken && (!authHeader || !authHeader.includes(expectedToken))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update: TelegramUpdate = await req.json();
    console.log('Telegram webhook received:', JSON.stringify(update, null, 2));

    // Gestisci messaggio
    if (update.message) {
      if (update.message.location) {
        await handleLocation(update.message);
      } else if (update.message.text) {
        await handleCommand(update.message);
      }
    }

    // Gestisci callback query (bottoni inline)
    if (update.callback_query) {
      // TODO: Implementare gestione callback query
      console.log('Callback query received:', update.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Endpoint per configurare il webhook (GET per debug)
export async function GET(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    // Ottieni info sul bot
    const botResponse = await fetch(`${TELEGRAM_API_URL}/getMe`);
    const botInfo = await botResponse.json();

    // Ottieni info sul webhook
    const webhookResponse = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const webhookInfo = await webhookResponse.json();

    return NextResponse.json({
      bot: botInfo.result,
      webhook: webhookInfo.result,
      endpoints: {
        webhook: `${req.nextUrl.origin}/api/telegram/webhook`,
        setup: `${req.nextUrl.origin}/api/telegram/setup`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching bot info' });
  }
}
