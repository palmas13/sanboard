import type { NextResponse } from 'next/server';

const SAFE_METRIC_NAME = /^(session|actor|profile|database|repository|serialize|total|store|application|subscription|listings|favorites|tickets|payments|notifications|bootstrap)$/;

export class ServerTiming {
  private readonly startedAt = performance.now();
  private readonly metrics: Array<{ name: string; duration: number }> = [];

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      this.add(name, performance.now() - startedAt);
    }
  }

  add(name: string, duration: number): void {
    if (!SAFE_METRIC_NAME.test(name) || !Number.isFinite(duration) || duration < 0) return;
    this.metrics.push({ name, duration });
  }

  respond<T extends NextResponse>(response: T): T {
    const metrics = [...this.metrics, { name: 'total', duration: performance.now() - this.startedAt }];
    response.headers.set(
      'Server-Timing',
      metrics.map(({ name, duration }) => `${name};dur=${duration.toFixed(1)}`).join(', ')
    );
    return response;
  }
}