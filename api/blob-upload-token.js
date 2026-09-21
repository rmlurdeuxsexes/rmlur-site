import { handleUpload } from '@vercel/blob/client';
import { verifySession } from './_lib/auth.js';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (!verifySession(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();

    try {
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/webp',
            'audio/mpeg', 'audio/wav', 'audio/x-wav',
            'application/zip', 'application/x-zip-compressed',
            'application/octet-stream',
          ],
          addRandomSuffix: true,
        }),
        onUploadCompleted: async ({ blob }) => {
          console.log('[blob-upload-token] upload completed:', blob.url);
        },
      });
      return Response.json(jsonResponse);
    } catch (err) {
      console.error('[api/blob-upload-token] error:', err);
      return Response.json({ error: err.message }, { status: 400 });
    }
  },
};
