import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";

// Security middleware for usage routes
export const securityMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Log suspicious activity
    const userAgent = req.get('User-Agent') || '';
    const suspiciousPatterns = ['curl', 'wget', 'python', 'bot', 'crawler'];

    if (suspiciousPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))) {
        console.warn(`🚨 Suspicious usage request from ${req.ip}:`, {
            userAgent,
            userId: req.user?.id,
            endpoint: req.path,
            method: req.method
        });
    }

    // Add security headers
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
    });

    next();
};