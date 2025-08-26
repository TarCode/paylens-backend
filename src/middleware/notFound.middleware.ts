import { Request, Response, NextFunction } from 'express';

export const notFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): Response => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    return res.json({
        success: false,
        error: {
            message: error.message,
            status: 404
        }
    });
};
