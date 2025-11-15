import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            res.status(400).json({ error: 'Validation failed', details: errors });
            return;
        }

        next();
    };
};

export const schemas = {
    register: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        fullName: Joi.string().min(2).required(),
        role: Joi.string().valid('admin', 'manager', 'viewer').default('viewer'),
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
    }),

    createInputStream: Joi.object({
        name: Joi.string().min(2).required(),
        rtspUrl: Joi.string().uri().required(),
        username: Joi.string().allow('', null),
        password: Joi.string().allow('', null),
    }),

    createOutputStream: Joi.object({
        name: Joi.string().min(2).required(),
        layoutTemplateId: Joi.number().integer().required(),
        resolution: Joi.string().pattern(/^\d+x\d+$/).default('1920x1080'),
        framerate: Joi.number().integer().min(1).max(60).default(25),
        bitrate: Joi.string().default('2000k'),
    }),

    createMapping: Joi.object({
        outputStreamId: Joi.number().integer().required(),
        inputStreamId: Joi.number().integer().required(),
        slotPosition: Joi.number().integer().min(0).required(),
    }),

    updateUser: Joi.object({
        email: Joi.string().email(),
        fullName: Joi.string().min(2),
        role: Joi.string().valid('admin', 'manager', 'viewer'),
        isActive: Joi.boolean(),
    }).min(1),
};
