import type { Context } from "@netlify/functions";
import { handleApi } from "../../backend/app";

export default async (request: Request, _context: Context): Promise<Response> => handleApi(request);

