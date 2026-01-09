import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/whatsapp/templates/image/[handle]
 * Proxy image from Meta WhatsApp Business API
 * Meta template images are referenced by handle and need to be fetched with authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  try {
    const { handle } = params;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'META_ACCESS_TOKEN not configured' },
        { status: 500 }
      );
    }

    if (!handle) {
      return NextResponse.json(
        { error: 'Image handle is required' },
        { status: 400 }
      );
    }

    // Meta image URL format
    // Try different possible formats
    const imageUrls = [
      `https://lookaside.fbsbx.com/whatsapp_business/${handle}`,
      `https://graph.facebook.com/v18.0/${handle}`,
      `https://graph.facebook.com/v18.0/${handle}/picture`,
    ];

    // Try to fetch from Meta
    for (const imageUrl of imageUrls) {
      try {
        const response = await fetch(imageUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          redirect: 'follow',
        });

        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/jpeg';

          return new NextResponse(imageBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      } catch (err) {
        // Try next URL
        continue;
      }
    }

    // If all URLs fail, return error
    return NextResponse.json(
      { error: 'Failed to fetch image from Meta' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching template image:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch image',
      },
      { status: 500 }
    );
  }
}


