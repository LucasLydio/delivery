import { schedule } from "@netlify/functions";
import { createDefaultOrdersService } from "../../backend/modules/orders/orders.factory";

export const handler = schedule("0 * * * *", async () => {
  const cancelled = await createDefaultOrdersService().cancelExpired();
  return { statusCode: 200, body: JSON.stringify({ cancelled }) };
});

