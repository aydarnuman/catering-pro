/**
 * Circuit Breaker Unit Tests
 * API ve DB circuit breaker testleri
 */

import { afterEach, describe, expect, test } from 'vitest';
import {
  checkApiCircuit,
  checkDbCircuit,
  getApiCircuitStatus,
  getDbCircuitStatus,
  reportApiError,
  reportDbError,
  reportDbSuccess,
  resetApiCircuit,
  resetDbCircuit,
} from '../circuit-breaker.js';

// ==================== API Circuit Breaker ====================

describe('API Circuit Breaker', () => {
  afterEach(() => {
    resetApiCircuit();
  });

  test('başlangıçta açık (allowed)', () => {
    const result = checkApiCircuit();
    expect(result.allowed).toBe(true);
  });

  test('normal hata circuit trip etmez', () => {
    const error = new Error('timeout');
    const isFatal = reportApiError(error);
    expect(isFatal).toBe(false);
    expect(checkApiCircuit().allowed).toBe(true);
  });

  test('"credit balance is too low" circuit trip eder', () => {
    const error = new Error('Your credit balance is too low to access the Anthropic API');
    const isFatal = reportApiError(error);
    expect(isFatal).toBe(true);
    expect(checkApiCircuit().allowed).toBe(false);
    expect(checkApiCircuit().reason).toContain('credit balance');
  });

  test('"insufficient_quota" circuit trip eder', () => {
    const error = new Error('insufficient_quota: account has no remaining credits');
    const isFatal = reportApiError(error);
    expect(isFatal).toBe(true);
    expect(checkApiCircuit().allowed).toBe(false);
  });

  test('"billing_not_active" circuit trip eder', () => {
    const error = { message: '', error: { message: 'billing_not_active' } };
    const isFatal = reportApiError(error);
    expect(isFatal).toBe(true);
    expect(checkApiCircuit().allowed).toBe(false);
  });

  test('trip sonrası tüm çağrılar engellenir', () => {
    reportApiError(new Error('credit balance is too low'));
    expect(checkApiCircuit().allowed).toBe(false);
    expect(checkApiCircuit().allowed).toBe(false);
    expect(checkApiCircuit().allowed).toBe(false);
  });

  test('trip sonrası skippedCalls sayılır', () => {
    reportApiError(new Error('credit balance is too low'));
    checkApiCircuit();
    checkApiCircuit();
    checkApiCircuit();
    expect(getApiCircuitStatus().skippedCalls).toBe(3);
  });

  test('reset sonrası tekrar açılır', () => {
    reportApiError(new Error('credit balance is too low'));
    expect(checkApiCircuit().allowed).toBe(false);
    resetApiCircuit();
    expect(checkApiCircuit().allowed).toBe(true);
    expect(getApiCircuitStatus().reason).toBeNull();
  });

  test('duplicate trip sadece bir kez kaydedilir', () => {
    reportApiError(new Error('credit balance is too low'));
    const status1 = getApiCircuitStatus();
    reportApiError(new Error('credit balance is too low'));
    const status2 = getApiCircuitStatus();
    // trippedAt değişmemeli
    expect(status1.trippedAt).toEqual(status2.trippedAt);
  });

  test('error.error.message ile de tespit eder (Anthropic SDK formatı)', () => {
    const error = {
      message: 'Request failed',
      error: { message: 'Your credit balance is too low' },
    };
    expect(reportApiError(error)).toBe(true);
    expect(checkApiCircuit().allowed).toBe(false);
  });
});

// ==================== DB Circuit Breaker ====================

describe('DB Circuit Breaker', () => {
  afterEach(() => {
    resetDbCircuit();
  });

  test('başlangıçta açık (allowed)', () => {
    const result = checkDbCircuit();
    expect(result.allowed).toBe(true);
  });

  test('normal SQL hatası timeout sayılmaz', () => {
    const error = new Error('relation "users" does not exist');
    error.code = '42P01';
    reportDbError(error);
    expect(checkDbCircuit().allowed).toBe(true);
  });

  test('1 timeout circuit trip etmez', () => {
    reportDbError(new Error('Connection terminated due to connection timeout'));
    expect(checkDbCircuit().allowed).toBe(true);
  });

  test('2 timeout circuit trip etmez', () => {
    reportDbError(new Error('Connection terminated due to connection timeout'));
    reportDbError(new Error('Connection terminated due to connection timeout'));
    expect(checkDbCircuit().allowed).toBe(true);
  });

  test('3 ardışık timeout circuit trip eder', () => {
    reportDbError(new Error('Connection terminated due to connection timeout'));
    reportDbError(new Error('Connection terminated due to connection timeout'));
    reportDbError(new Error('Connection terminated due to connection timeout'));
    expect(checkDbCircuit().allowed).toBe(false);
    expect(checkDbCircuit().reason).toContain('timeout');
  });

  test('araya başarılı sorgu girerse sayaç sıfırlanır', () => {
    reportDbError(new Error('Connection terminated due to connection timeout'));
    reportDbError(new Error('Connection terminated due to connection timeout'));
    reportDbSuccess(); // Sayaç sıfırlandı
    reportDbError(new Error('Connection terminated due to connection timeout'));
    // Sadece 1 timeout, trip olmamalı
    expect(checkDbCircuit().allowed).toBe(true);
  });

  test('ETIMEDOUT kodu da timeout sayılır', () => {
    const errors = [
      { message: 'connect ETIMEDOUT', code: 'ETIMEDOUT' },
      { message: 'Connection reset', code: 'ECONNRESET' },
      { message: 'Connection refused', code: 'ECONNREFUSED' },
    ];
    for (const err of errors) {
      reportDbError(err);
    }
    expect(checkDbCircuit().allowed).toBe(false);
  });

  test('farklı hata tipi ardışık timeout sayacını sıfırlar', () => {
    reportDbError(new Error('Connection terminated due to connection timeout'));
    reportDbError(new Error('Connection terminated due to connection timeout'));
    // Farklı hata - timeout değil
    const sqlError = new Error('syntax error');
    sqlError.code = '42601';
    reportDbError(sqlError);
    // Sayaç sıfırlanmış olmalı
    reportDbError(new Error('Connection terminated due to connection timeout'));
    // Sadece 1 timeout, trip olmamalı
    expect(checkDbCircuit().allowed).toBe(true);
  });

  test('skippedQueries sayılır', () => {
    reportDbError(new Error('ETIMEDOUT'));
    reportDbError(new Error('ETIMEDOUT'));
    reportDbError(new Error('ETIMEDOUT'));
    // Tripped - kontrol et
    checkDbCircuit();
    checkDbCircuit();
    expect(getDbCircuitStatus().skippedQueries).toBe(2);
  });

  test('reset sonrası açılır', () => {
    reportDbError(new Error('ETIMEDOUT'));
    reportDbError(new Error('ETIMEDOUT'));
    reportDbError(new Error('ETIMEDOUT'));
    expect(checkDbCircuit().allowed).toBe(false);
    resetDbCircuit();
    expect(checkDbCircuit().allowed).toBe(true);
  });
});
