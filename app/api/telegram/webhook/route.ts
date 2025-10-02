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
async function sendMessage(chatId: number | bigint, text: string, options: any = {}) {
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

async function sendLocation(chatId: number | bigint, lat: number, lon: number, title?: string) {
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

  // Gestisci anche i testi dei bottoni della tastiera
  if (text === '🔔 Iscriviti alle notifiche') {
    return handleSubscribeCommand(chatId, userId, '/subscribe all');
  }
  if (text === '💰 Prezzi oggi') {
    return handlePricesCommand(chatId, '/prezzi Roma');
  }
  if (text === '❓ Aiuto') {
    return handleHelpCommand(chatId);
  }

  switch (command) {
    case '/start':
      return handleStartCommand(chatId, userId, message.from);
    
    case '/subscribe':
    case '/iscriviti':
      return handleSubscribeCommand(chatId, userId, text);
    
    case '/unsubscribe':
    case '/disiscriviti':
      return handleUnsubscribeCommand(chatId, userId, text);
    
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

async function saveUser(user: TelegramUser, chatId: number | bigint) {
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

async function handleStartCommand(chatId: number | bigint, userId: number, user: TelegramUser) {
  const welcomeText = `
🚗 <b>Benvenuto in BenzinaOggi Bot!</b>

Ciao ${user.first_name}! Sono il bot ufficiale di BenzinaOggi.it 🚗

<b>Cosa posso fare per te:</b>
🔔 Inviarti notifiche sui ribassi dei prezzi
📍 Cercare distributori vicini a te
💰 Mostrarti i prezzi aggiornati in tempo reale
📊 Fornirti statistiche sui prezzi

<b>Comandi disponibili:</b>
/subscribe [città] - Notifiche per una città specifica
/subscribe all - Iscriviti a tutte le notifiche ribassi
/prezzi [città] - Mostra prezzi in una città
/cerca [località] - Cerca distributori
/status - Vedi le tue iscrizioni
/help - Mostra tutti i comandi

<b>Per iniziare subito:</b>
1. Scrivi: <code>/subscribe Roma</code> per notifiche da Roma
2. Oppure: <code>/subscribe all</code> per tutte le notifiche
3. Invia la tua posizione per trovare distributori vicini

Visita anche il nostro sito: https://www.benzinaoggi.it
`;

  return sendMessage(chatId, welcomeText, {
    reply_markup: {
      keyboard: [
        [{ text: '🔔 Iscriviti alle notifiche' }],
        [{ text: '📍 Invia posizione', request_location: true }],
        [{ text: '💰 Prezzi oggi' }],
        [{ text: '❓ Aiuto' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

async function handleSubscribeCommand(chatId: number | bigint, userId: number, text: string) {
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
      // Cerca se esiste già una subscription di tipo ALL per questo utente
      const existing = await prisma.telegramSubscription.findFirst({
        where: {
          telegramId: userId,
          type: 'ALL'
        }
      });

      if (existing) {
        // Aggiorna quella esistente
        await prisma.telegramSubscription.update({
          where: { id: existing.id },
          data: { isActive: true }
        });
      } else {
        // Crea una nuova subscription
        await prisma.telegramSubscription.create({
          data: {
            telegramId: userId,
            type: 'ALL',
            isActive: true
          }
        });
      }

      return sendMessage(chatId, `
✅ <b>Iscrizione completata!</b>

Riceverai notifiche per tutti i ribassi di prezzo in Italia.

Usa /status per vedere le tue iscrizioni attive.
`);
    } catch (error) {
      return sendMessage(chatId, '❌ Errore durante l\'iscrizione. Riprova più tardi.');
    }
  }

  // Gestione iscrizione per città
  const cityName = parts.slice(1).join(' ').trim();
  if (cityName && cityName !== 'all') {
    try {
      // Cerca se esiste già una subscription di tipo CITY per questa città
      const existing = await prisma.telegramSubscription.findFirst({
        where: {
          telegramId: userId,
          type: 'CITY',
          city: cityName
        }
      });

      if (existing) {
        // Aggiorna quella esistente
        await prisma.telegramSubscription.update({
          where: { id: existing.id },
          data: { isActive: true }
        });
      } else {
        // Crea una nuova subscription per città
        await prisma.telegramSubscription.create({
          data: {
            telegramId: userId,
            type: 'CITY',
            city: cityName,
            isActive: true
          }
        });
      }

      return sendMessage(chatId, `
✅ <b>Iscrizione completata!</b>

Riceverai notifiche per i ribassi di prezzo a <b>${cityName}</b>.

Usa /status per vedere le tue iscrizioni attive.
`);
    } catch (error) {
      console.error('Error creating city subscription:', error);
      return sendMessage(chatId, '❌ Errore durante l\'iscrizione alla città. Riprova più tardi.');
    }
  }

  return sendMessage(chatId, 'Formato non riconosciuto. Usa <code>/subscribe [città]</code> o <code>/subscribe all</code>.');
}

async function handleUnsubscribeCommand(chatId: number | bigint, userId: number, text: string) {
  const parts = text.split(' ');
  
  // Se viene specificata una città, disiscriviti solo da quella
  if (parts.length > 1) {
    const cityName = parts.slice(1).join(' ').trim();
    
    try {
      const result = await prisma.telegramSubscription.updateMany({
        where: { 
          telegramId: userId,
          type: 'CITY',
          city: cityName
        },
        data: { isActive: false }
      });

      if (result.count > 0) {
        return sendMessage(chatId, `
✅ <b>Disiscrizione completata!</b>

Non riceverai più notifiche per i ribassi a <b>${cityName}</b>.

Le altre tue iscrizioni rimangono attive.
Usa /status per vedere tutte le iscrizioni.
`);
      } else {
        return sendMessage(chatId, `Non risulti iscritto alle notifiche per "${cityName}".`);
      }
    } catch (error) {
      return sendMessage(chatId, '❌ Errore durante la disiscrizione. Riprova più tardi.');
    }
  }

  // Disiscrizione da tutte le notifiche
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

async function handlePricesCommand(chatId: number | bigint, text: string) {
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
      
      // Aggiungi link alla pagina del distributore
      if (dist.impiantoId) {
        const bandiera = (dist.bandiera || 'distributore').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const comune = (dist.comune || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const slug = `${bandiera}-${comune}-${dist.impiantoId}`;
        const pageUrl = `https://www.benzinaoggi.it/distributore/${slug}`;
        pricesText += `🔗 <a href="${pageUrl}">Vedi dettagli</a>\n`;
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

async function handleSearchCommand(chatId: number | bigint, text: string) {
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

async function handleStatusCommand(chatId: number | bigint, userId: number) {
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

    statusText += `
<b>Gestione iscrizioni:</b>
• /unsubscribe - Disiscriviti da tutto
• /unsubscribe [città] - Disiscriviti da una città specifica

<b>Esempi:</b>
• <code>/unsubscribe Roma</code>
• <code>/subscribe Milano</code>
`;

    return sendMessage(chatId, statusText);
  } catch (error) {
    return sendMessage(chatId, '❌ Errore nel recupero dello status. Riprova più tardi.');
  }
}

async function handleHelpCommand(chatId: number | bigint) {
  const helpText = `
❓ <b>Comandi disponibili</b>

<b>Notifiche:</b>
/subscribe [città] - Iscriviti alle notifiche per una città
/subscribe all - Iscriviti a tutte le notifiche
/unsubscribe - Disiscriviti da tutte le notifiche
/unsubscribe [città] - Disiscriviti da una città specifica
/status - Vedi le tue iscrizioni

<b>Prezzi e Ricerca:</b>
/prezzi [città] - Mostra prezzi in una città
/cerca [località] - Cerca distributori
📍 Invia posizione - Trova distributori vicini

<b>Altro:</b>
/help - Mostra questo messaggio
/start - Messaggio di benvenuto

<b>Esempi pratici:</b>
• <code>/subscribe Roma</code> - Notifiche per Roma
• <code>/subscribe all</code> - Tutte le notifiche
• <code>/unsubscribe Milano</code> - Stop notifiche Milano
• <code>/prezzi Napoli</code> - Prezzi a Napoli
• <code>/cerca Milano centro</code> - Cerca a Milano centro

🌐 Sito web: https://www.benzinaoggi.it
`;

  return sendMessage(chatId, helpText);
}

async function handleUnknownCommand(chatId: number | bigint) {
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
      
      // Aggiungi link alla pagina del distributore
      if (dist.impiantoId) {
        const bandiera = (dist.bandiera || 'distributore').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const comune = (dist.comune || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const slug = `${bandiera}-${comune}-${dist.impiantoId}`;
        const pageUrl = `https://www.benzinaoggi.it/distributore/${slug}`;
        locationText += `🔗 <a href="${pageUrl}">Vedi dettagli</a>\n`;
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
