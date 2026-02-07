/**
 * Tender Document Module - Public API
 *
 * İhale döküman yönetimi için merkezi modül.
 * Bu modül document-storage, tender-content-service ve document-queue-processor
 * servislerini birleştirir.
 *
 * Kullanım:
 *   import { merkezScraper, createContentDocuments } from './services/tender-document';
 */

// Document Queue Processor
import documentQueueProcessor from '../document-queue-processor.js';
// Document Storage Service
import documentStorageService from '../document-storage.js';
// Tender Content Service
import tenderContentService from '../tender-content-service.js';

// Re-export storage functions - MERKEZ SCRAPER (eski downloadTenderDocuments yerine)
export const merkezScraper = (tenderId) => documentStorageService.merkezScraper(tenderId);

// Geriye uyumluluk alias
export const downloadTenderDocuments = merkezScraper;

export const downloadAndStore = (tenderId, docType, url, displayName) =>
  documentStorageService.downloadAndStore(tenderId, docType, url, displayName);

export const getDownloadedDocuments = (tenderId) => documentStorageService.getDownloadedDocuments(tenderId);

export const getSignedUrl = (documentId, expiresIn) => documentStorageService.getSignedUrl(documentId, expiresIn);

export const addToQueue = (documentId) => documentStorageService.addToQueue(documentId);

export const addMultipleToQueue = (documentIds) => documentStorageService.addMultipleToQueue(documentIds);

// Re-export content functions
export const createContentDocuments = (tenderId) => tenderContentService.createContentDocuments(tenderId);

export const getContentDocuments = (tenderId) => tenderContentService.getContentDocuments(tenderId);

export const getAllDocuments = (tenderId) => tenderContentService.getAllDocuments(tenderId);

// Re-export queue functions
export const startQueueProcessor = () => documentQueueProcessor.start();

export const stopQueueProcessor = () => documentQueueProcessor.stop();

export const getQueueStatus = () => documentQueueProcessor.getQueueStatus();

export const processQueue = () => documentQueueProcessor.processQueue();

// Default export - all services combined
export default {
  // Merkez Scraper
  merkezScraper,
  downloadTenderDocuments, // geriye uyumluluk alias
  downloadAndStore,
  getDownloadedDocuments,
  getSignedUrl,
  addToQueue,
  addMultipleToQueue,

  // Content
  createContentDocuments,
  getContentDocuments,
  getAllDocuments,

  // Queue
  startQueueProcessor,
  stopQueueProcessor,
  getQueueStatus,
  processQueue,

  // Raw services for advanced usage
  storageService: documentStorageService,
  contentService: tenderContentService,
  queueProcessor: documentQueueProcessor,
};
