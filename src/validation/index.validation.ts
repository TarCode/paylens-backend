import { Response } from 'express';

export const ok = (res: Response, data?: unknown) => res.json({ success: true, ...(data ? { data } : {}) });

export const created = (res: Response, data?: unknown, message?: string) =>
    res.status(201).json({ success: true, ...(message ? { message } : {}), ...(data ? { data } : {}) });

export const badRequest = (res: Response, error: unknown, message = 'Bad request') =>
    res.status(400).json({ success: false, error: { message, details: error } });

export const unauthorized = (res: Response, message = 'Unauthorized') =>
    res.status(401).json({ success: false, error: { message } });

export const notFound = (res: Response, message = 'Not found') =>
    res.status(404).json({ success: false, error: { message } });

export const serverError = (res: Response, message = 'Internal server error') =>
    res.status(500).json({ success: false, error: { message } });
