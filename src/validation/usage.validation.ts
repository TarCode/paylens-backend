import { Response } from 'express';
import {
    ok,
    created,
    badRequest,
    unauthorized,
    notFound,
    serverError
} from './index.validation';

export const tooManyRequests = (res: Response, data?: unknown, message?: string) =>
    res.status(429).json({ success: false, ...(message ? { message } : {}), ...(data ? { data } : {}) });

export {
    ok,
    created,
    badRequest,
    unauthorized,
    notFound,
    serverError
};