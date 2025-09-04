import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import db from '../models/index';
import { AppError } from "./errorMiddleware";

const { User } = db;

// --- INTERFACES ---

interface CustomRequest extends Request {
  user?: InstanceType<typeof User>;
}
// --- MIDDLEWARE ---

/**
 * Middleware untuk melindungi rute dengan memeriksa JWT yang valid.
 * Menangani request API dan navigasi browser.
 */
export const protect = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    const isApiRequest = req.originalUrl.startsWith('/api');

    if (!token || token === "loggedout") {
      const message = 'You are not logged in. Please log in to get access.';
      if (isApiRequest) {
        res.status(401).json({ status: 'fail', message });
      } else {
        res.redirect("/login");
      }
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in the environment variables');
    }

    // Use synchronous jwt.verify which throws an error on failure, caught by the outer catch block
    const decoded = jwt.verify(token, secret) as { id: number; iat: number; exp: number };

    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
      const message = 'The user belonging to this token does no longer exist.';
      if (isApiRequest) {
        res.status(401).json({ status: 'fail', message });
      } else {
        res.clearCookie("jwt");
        res.redirect("/login");
      }
      return;
    }

    if (!currentUser.isActive) {
        const message = 'Your account has been deactivated. Please contact support.';
        if (isApiRequest) {
            res.status(403).json({ status: 'fail', message });
        } else {
            res.clearCookie("jwt");
            res.redirect("/login?message=account_deactivated");
        }
        return;
    }

    req.user = currentUser;
    next();

  } catch (error) {
    const isApiRequest = req.originalUrl.startsWith('/api');
    const message = 'Invalid or expired token. Please log in again.';
    if (isApiRequest) {
      res.status(401).json({ status: 'fail', message });
    } else {
      res.redirect("/login");
    }
  }
};

/**
 * Middleware untuk membatasi akses ke peran (role) tertentu.
 */
export const restrictTo = (...roles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).send('<h1>403 - Forbidden</h1><p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>');
      return;
    }
    next();
  };
};