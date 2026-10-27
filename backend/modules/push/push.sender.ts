import webPush from 'web-push';
import type { OrderSummary } from '../../../shared/commerce-contract';
import type { PushRepository, StoredPushSubscription } from './push.repository';

export interface OrderNotifier {
  notify(order: OrderSummary): Promise<void>;
}

export const noOpOrderNotifier: OrderNotifier = { notify: async () => {} };

export interface PushSenderConfig {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
}

function notificationCopy(status: OrderSummary['status']): { title: string; body: string } {
  switch (status) {
    case 'CONFIRMED':
      return { title: 'Pedido confirmado', body: 'Seu pedido foi confirmado pela loja.' };
    case 'PREPARING':
      return { title: 'Pedido em preparo', body: 'A loja começou a preparar seu pedido.' };
    case 'READY':
      return { title: 'Pedido pronto', body: 'Seu pedido está pronto para a próxima etapa.' };
    case 'OUT_FOR_DELIVERY':
      return { title: 'Pedido saiu para entrega', body: 'Seu pedido está a caminho.' };
    case 'COMPLETED':
      return { title: 'Pedido concluído', body: 'Seu pedido foi entregue. Bom apetite!' };
    case 'PAYMENT_FAILED':
      return { title: 'Pagamento não aprovado', body: 'Revise o pagamento do seu pedido.' };
    case 'CANCELLED':
      return { title: 'Pedido cancelado', body: 'Abra o aplicativo para consultar os detalhes.' };
    default:
      return {
        title: 'Aguardando pagamento',
        body: 'Seu pedido está aguardando a confirmação do pagamento.',
      };
  }
}

function browserSubscription(subscription: StoredPushSubscription): webPush.PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
}

export class WebPushOrderNotifier implements OrderNotifier {
  private readonly enabled: boolean;

  constructor(
    private readonly repository: PushRepository,
    config: PushSenderConfig,
  ) {
    this.enabled = !!(config.publicKey && config.privateKey && config.subject);
    if (this.enabled)
      webPush.setVapidDetails(config.subject!, config.publicKey!, config.privateKey!);
  }

  async notify(order: OrderSummary): Promise<void> {
    if (!this.enabled) return;
    const subscriptions = await this.repository.listForOrder(order.id);
    if (!subscriptions.length) return;
    const copy = notificationCopy(order.status);
    const payload = JSON.stringify({
      notification: {
        title: copy.title,
        body: copy.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `order-${order.id}`,
        renotify: true,
        data: {
          onActionClick: {
            default: { operation: 'openWindow', url: `/orders/${encodeURIComponent(order.id)}` },
          },
        },
      },
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(browserSubscription(subscription), payload, {
            TTL: 300,
            urgency: 'high',
          });
        } catch (error) {
          const statusCode =
            typeof error === 'object' && error && 'statusCode' in error
              ? Number((error as { statusCode?: unknown }).statusCode)
              : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await this.repository.deleteByEndpoint(subscription.endpoint);
            return;
          }
          console.error('Order push delivery failed', { orderId: order.id, statusCode });
        }
      }),
    );
  }
}
