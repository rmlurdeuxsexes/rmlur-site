import { buildLicensePdf } from './_lib/checkout.js';
import { loadPaidOrder } from './order.js';

export default {
  async fetch(request) {
    const id = new URL(request.url).searchParams.get('session_id');
    try {
      const o = await loadPaidOrder(id);
      if (!o) return new Response('order not found or unpaid', { status: 404 });
      const pdf = buildLicensePdf({
        title: o.product.title, tierLabel: o.tier.label,
        buyerName: o.session.customer_details?.name, buyerEmail: o.session.customer_details?.email,
        orderId: o.session.id, date: new Date(o.session.created * 1000).toISOString().slice(0, 10),
      });
      return new Response(pdf, { headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="license-${o.product.id}.pdf"`,
      } });
    } catch (err) {
      console.error('[api/license]', err);
      return new Response('lookup failed', { status: 502 });
    }
  },
};
