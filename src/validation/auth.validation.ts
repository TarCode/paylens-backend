import {
    ok,
    created,
    badRequest,
    unauthorized,
    notFound,
    serverError
} from './index.validation';

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

export {
    ok,
    created,
    badRequest,
    unauthorized,
    notFound,
    serverError
};