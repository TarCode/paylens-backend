import { Response } from 'express';

import { body } from 'express-validator';

export const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
    body('firstName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('First name must be between 2 and 100 characters'),
    body('lastName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Last name must be between 2 and 100 characters'),
    body('companyName')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Company name must be less than 255 characters')
];

export const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

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
