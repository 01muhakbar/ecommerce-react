
import { Request, Response, NextFunction } from 'express';

// Class untuk error operasional yang bisa diprediksi
class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// --- Fungsi-fungsi kecil untuk menangani jenis error spesifik ---

const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);
const handleSequelizeValidationError = (err: any) => {
    const errors = Object.values(err.errors).map((el: any) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
}

// --- Fungsi utama untuk mengirim error ke client ---

const sendError = (err: any, res: Response) => {
    // Jika error operasional, kirim detailnya ke client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    // Jika error programming atau dari library lain, jangan bocorkan detailnya
    } else {
        // 1) Log error ke konsol
        console.error('ERROR 💥', err);

        // 2) Kirim respons generik
        res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!'
        });
    }
};

// --- Middleware Utama ---

const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    let error = { ...err };
    error.message = err.message;

    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'SequelizeValidationError') error = handleSequelizeValidationError(error);

    sendError(error, res);
};

export default globalErrorHandler;
