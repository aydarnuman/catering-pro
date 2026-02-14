/**
 * Quality Metrics & PipelineMonitor Tests
 * Chunk tracking, report generation, completeness metrics
 */

import { describe, expect, test } from 'vitest';
import { PipelineMonitor } from '../controls/quality-metrics.js';

describe('PipelineMonitor', () => {
  test('başlangıçta chunks 0/0', () => {
    const monitor = new PipelineMonitor('test-doc-1');
    expect(monitor.metrics.total_chunks).toBe(0);
    expect(monitor.metrics.processed_chunks).toBe(0);
    expect(monitor.metrics.failed_chunks).toBe(0);
  });

  test('recordChunkProcessed(true) processed_chunks artırır', () => {
    const monitor = new PipelineMonitor('test-doc-2');
    monitor.recordChunkProcessed(true);
    monitor.recordChunkProcessed(true);
    monitor.recordChunkProcessed(true);
    expect(monitor.metrics.total_chunks).toBe(3);
    expect(monitor.metrics.processed_chunks).toBe(3);
    expect(monitor.metrics.failed_chunks).toBe(0);
  });

  test('recordChunkProcessed(false) failed_chunks artırır', () => {
    const monitor = new PipelineMonitor('test-doc-3');
    monitor.recordChunkProcessed(true);
    monitor.recordChunkProcessed(false);
    monitor.recordChunkProcessed(true);
    expect(monitor.metrics.total_chunks).toBe(3);
    expect(monitor.metrics.processed_chunks).toBe(2);
    expect(monitor.metrics.failed_chunks).toBe(1);
  });

  test('generateReport chunk metrikleri doğru döner', () => {
    const monitor = new PipelineMonitor('test-doc-4');
    monitor.startStage('test_stage');
    monitor.recordChunkProcessed(true);
    monitor.recordChunkProcessed(true);
    monitor.recordChunkProcessed(false);
    monitor.endStage({ test: true });

    const report = monitor.generateReport();
    expect(report.metrics.total_chunks).toBe(3);
    expect(report.metrics.processed_chunks).toBe(2);
    expect(report.metrics.failed_chunks).toBe(1);
    expect(report.performance_summary.success_rate).toBe(67); // Math.round(2/3*100)
  });

  test('generateReport chunks_per_second hesaplar', () => {
    const monitor = new PipelineMonitor('test-doc-5');
    for (let i = 0; i < 10; i++) {
      monitor.recordChunkProcessed(true);
    }
    const report = monitor.generateReport();
    expect(report.performance_summary.chunks_per_second).toBeGreaterThan(0);
  });

  test('generateReport chunk olmadığında success_rate 100 döner', () => {
    const monitor = new PipelineMonitor('test-doc-6');
    const report = monitor.generateReport();
    expect(report.performance_summary.success_rate).toBe(100);
    expect(report.performance_summary.chunks_per_second).toBe(0);
  });

  test('recordApiCall doğru provider sayar', () => {
    const monitor = new PipelineMonitor('test-doc-7');
    monitor.recordApiCall('azure');
    monitor.recordApiCall('azure');
    monitor.recordApiCall('claude', { input: 1000, output: 500 });
    expect(monitor.metrics.api_calls.azure).toBe(2);
    expect(monitor.metrics.api_calls.claude).toBe(1);
    expect(monitor.metrics.token_usage.input).toBe(1000);
    expect(monitor.metrics.token_usage.output).toBe(500);
  });

  test('stage tracking doğru çalışır', () => {
    const monitor = new PipelineMonitor('test-doc-8');
    monitor.startStage('stage1');
    monitor.endStage({ result: 'ok' });
    monitor.startStage('stage2');
    monitor.endStage({ result: 'ok' });

    const report = monitor.generateReport();
    expect(report.stages).toHaveLength(2);
    expect(report.stages[0].name).toBe('stage1');
    expect(report.stages[1].name).toBe('stage2');
    expect(report.stages[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  test('recordError hata kaydeder', () => {
    const monitor = new PipelineMonitor('test-doc-9');
    monitor.recordError('analysis', new Error('test error'));
    expect(monitor.metrics.errors).toHaveLength(1);
    expect(monitor.metrics.errors[0].stage).toBe('analysis');
    expect(monitor.metrics.errors[0].error).toBe('test error');
  });
});
