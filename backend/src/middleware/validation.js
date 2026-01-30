/**
 * VALIDATION MIDDLEWARE
 * Input validation ve sanitization için express-validator kullanır
 */

import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';

/**
 * Validation hatalarını kontrol et ve response dön
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    logger.warn('Validation hatası', {
      path: req.path,
      method: req.method,
      errors: errorMessages,
      ip: req.ip,
    });

    return res.status(400).json({
      success: false,
      error: 'Geçersiz parametreler',
      details: errorMessages,
    });
  }

  next();
};

/**
 * Pagination parametrelerini normalize et
 * Validation'dan sonra çalışmalı
 */
export const normalizePagination = (req, _res, next) => {
  // Default değerler
  req.pagination = {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
  };

  // Limit'i güvenli aralıkta tut
  if (req.pagination.limit > 100) req.pagination.limit = 100;
  if (req.pagination.limit < 1) req.pagination.limit = 20;

  // Page'i güvenli aralıkta tut
  if (req.pagination.page < 1) req.pagination.page = 1;
  if (req.pagination.page > 10000) req.pagination.page = 10000;

  // Offset hesapla
  req.pagination.offset = (req.pagination.page - 1) * req.pagination.limit;

  next();
};

/**
 * String parametrelerini trim et
 */
export const trimStrings = (req, _res, next) => {
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }

  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }

  next();
};
