import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bandiera = searchParams.get('bandiera') || 'Q8';
    const comune = searchParams.get('comune') || 'ROMETTA';
    const impiantoId = searchParams.get('impiantoId') || '58674';

    // Simula la logica di WordPress sanitize_title
    function sanitizeTitle(title: string): string {
      return title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Genera il titolo e lo slug come fa WordPress
    const rawTitle = `${bandiera} ${comune}`;
    const title = rawTitle.trim().replace(/\s+/g, ' ');
    const slug = sanitizeTitle(`${title}-${impiantoId}`);

    // Genera anche il formato alternativo
    const alternativeSlug = sanitizeTitle(`${bandiera}-${comune}-${impiantoId}`);

    return NextResponse.json({
      ok: true,
      input: {
        bandiera,
        comune,
        impiantoId
      },
      generated: {
        rawTitle,
        title,
        slug,
        alternativeSlug
      },
      urls: {
        primary: `/${slug}/`,
        alternative: `/${alternativeSlug}/`,
        fallback: `/distributore-${impiantoId}/`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test-slug-generation:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to generate slug',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
