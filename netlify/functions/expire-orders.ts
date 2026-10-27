import { schedule } from "@netlify/functions";
import { createDefaultMaintenanceService } from "../../backend/modules/maintenance/maintenance.factory";
import { createDefaultOrdersService } from "../../backend/modules/orders/orders.factory";

export const handler = schedule("0 * * * *", async () => {
  const cleaned = await createDefaultMaintenanceService().cleanup();
  const cancelled = await createDefaultOrdersService().cancelExpired();
  return { statusCode: 200, body: JSON.stringify({ cancelled, cleaned }) };
});

