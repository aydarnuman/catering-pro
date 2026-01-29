/**
 * Unified Notes System - Main Router
 * Combines all note-related routes
 */

import express from 'express';
import personalRoutes from './personal.js';
import contextualRoutes from './contextual.js';
import tagsRoutes from './tags.js';
import remindersRoutes from './reminders.js';
import attachmentsRoutes from './attachments.js';

const router = express.Router();

// Personal notes: /api/notes
router.use('/', personalRoutes);

// Context-specific notes: /api/notes/context/:type/:id
router.use('/context', contextualRoutes);

// Tags: /api/notes/tags
router.use('/tags', tagsRoutes);

// Reminders: /api/notes/reminders
router.use('/reminders', remindersRoutes);

// Attachments: /api/notes/attachments
router.use('/attachments', attachmentsRoutes);

export default router;
