import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository } from '@/lib/db/repositories';
import { getFleecaPaymentProvider } from '@/lib/integrations/fleeca';

export async function POST(req: NextRequest) {
  try {
    const { profileId, packageCode } = await req.json();

    if (!profileId) {
      return NextResponse.json(
        { error: 'Karakter profili zorunludur.' },
        { status: 400 }
      );
    }

    // Backend determines price from packageCode strictly via payment repository
    const repo = getPaymentRepository();
    const order = await repo.createPaymentOrder(profileId, packageCode || 'STANDARD_7_DAY');

    // Also notify Fleeca provider
    const fleeca = getFleecaPaymentProvider();
    await fleeca.createOrder({
      orderId: order.orderId,
      profileId,
      characterName: 'Kullanıcı',
      packageCode: packageCode || 'STANDARD_7_DAY',
      amount: order.amount,
    });

    return NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      packageName: order.packageName || '7 Günlük Standart İlan',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Sipariş oluşturulamadı.' },
      { status: 500 }
    );
  }
}

// Process / simulate payment endpoint
export async function PUT(req: NextRequest) {
  try {
    const { orderId, simulateSuccess } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId zorunludur.' },
        { status: 400 }
      );
    }

    const fleeca = getFleecaPaymentProvider();
    const result = await fleeca.processPayment(orderId, simulateSuccess);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Ödeme başarısız oldu.' },
        { status: 400 }
      );
    }

    // Mark as completed in database and issue listing credit via repository
    const repo = getPaymentRepository();
    const completion = await repo.completePayment(orderId, result.transactionId);

    if (!completion.success) {
      return NextResponse.json(
        { success: false, error: completion.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      credit: completion.credit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ödeme işlenemedi.' },
      { status: 500 }
    );
  }
}
