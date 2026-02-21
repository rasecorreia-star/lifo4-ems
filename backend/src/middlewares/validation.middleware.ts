import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

type RequestLocation = 'body' | 'query' | 'params';

/**
 * Middleware factory for validating request data with Zod schemas
 */
export const validate = <T>(
  schema: ZodSchema<T>,
  location: RequestLocation = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[location];
      const validated = schema.parse(data);

      // Replace the original data with validated/transformed data
      req[location] = validated as typeof req[typeof location];

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));

        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate multiple locations at once
 */
export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Array<{ location: string; field: string; message: string }> = [];

    for (const [location, schema] of Object.entries(schemas)) {
      if (schema) {
        try {
          const data = req[location as RequestLocation];
          const validated = schema.parse(data);
          (req as any)[location] = validated;
        } catch (error) {
          if (error instanceof ZodError) {
            error.errors.forEach(e => {
              errors.push({
                location,
                field: e.path.join('.'),
                message: e.message,
              });
            });
          }
        }
      }
    }

    if (errors.length > 0) {
      next(new ValidationError('Validation failed', errors));
    } else {
      next();
    }
  };
};
