// Class untuk error operasional yang bisa diprediksi
export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
// --- Fungsi-fungsi kecil untuk menangani jenis error spesifik ---
const handleJWTError = () => new AppError("Invalid token. Please log in again!", 401);
const handleJWTExpiredError = () => new AppError("Your token has expired! Please log in again.", 401);
const handleSequelizeValidationError = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    const message = `Invalid input data. ${errors.join(". ")}`;
    return new AppError(message, 400);
};
// --- Fungsi utama untuk mengirim error ke client ---
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};
const sendErrorProd = (err, res) => {
    // A) Operational, trusted error: send message to client
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }
    // B) Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error("ERROR 💥", err);
    // 2) Send generic message
    return res.status(500).json({
        status: "error",
        message: "Something went very wrong!",
    });
};
// --- Middleware Utama ---
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";
    let error = { ...err };
    error.message = err.message;
    if (error.name === "JsonWebTokenError")
        error = handleJWTError();
    if (error.name === "TokenExpiredError")
        error = handleJWTExpiredError();
    if (error.name === "SequelizeValidationError")
        error = handleSequelizeValidationError(error);
    if (process.env.NODE_ENV === "development") {
        sendErrorDev(error, res);
    }
    else if (process.env.NODE_ENV === "production") {
        sendErrorProd(error, res);
    }
};
export default globalErrorHandler;
