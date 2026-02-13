/**
 * Unified Notes System - Main Router
 * Combines all note-related routes
 */

import express from 'express';
import attachmentsRoutes from './attachments.js';
import contextualRoutes from './contextual.js';
import foldersRoutes from './folders.js';
import personalRoutes from './personal.js';
import remindersRoutes from './reminders.js';
import sharingRoutes from './sharing.js';
import tagsRoutes from './tags.js';
import trackerRoutes from './tracker.js';

const router = express.Router();

// Tracker: /api/notes/tracker (MUST be before personal to avoid /:id conflict)
router.use('/tracker', trackerRoutes);

// Folders: /api/notes/folders (MUST be before personal to avoid /:id conflict)
router.use('/folders', foldersRoutes);

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

// Sharing: /api/notes/sharing
router.use('/sharing', sharingRoutes);

export default router;
