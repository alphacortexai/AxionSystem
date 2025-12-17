// Next.js API Route for toggling AI on a ticket
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import twilio from 'twilio';

// Initialize Firebase Admin SDK (shared pattern with send-message route)
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT_KEY (toggle-ai):', error.message);
      console.warn('⚠️ Firebase Admin initialization failed during build - will retry at runtime (toggle-ai)');
    }
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not set during build - will be initialized at runtime in Vercel (toggle-ai)');
  }
}

export async function POST(request) {
  try {
    // Ensure Firebase Admin is initialized
    if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } catch (error) {
          console.error('❌ Error initializing Firebase Admin at runtime (toggle-ai):', error.message);
          return NextResponse.json({ error: 'Firebase configuration error' }, { status: 500 });
        }
      } else {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not available at runtime (toggle-ai)');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
    }

    const db = admin.firestore();
    const parsed = await request.json();
    const { convId, enable, tenantId } = parsed || {};

    if (!convId || typeof enable !== 'boolean' || !tenantId) {
      return NextResponse.json(
        {
          error: 'convId, boolean enable, and tenantId are required',
          received: parsed,
        },
        { status: 400 }
      );
    }

    // Load company configuration
    const companyRef = db.collection('companies').doc(tenantId);
    const companySnap = await companyRef.get();

    if (!companySnap.exists) {
      console.warn(`⚠️ Company ${tenantId} not found`);
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = companySnap.data();

    const ticketRef = db
      .collection('companies')
      .doc(tenantId)
      .collection('tickets')
      .doc(convId); // convId is actually ticketId in the new system

    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticketData = ticketSnap.data() || {};
    const to = ticketData.customerId;

    // 1️⃣ Update aiEnabled on ticket
    await ticketRef.update({
      aiEnabled: enable,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const statusText = enable
      ? 'Axion AI assistant has been turned ON. You may receive automated replies.'
      : 'Axion AI assistant has been turned OFF. You are now chatting with a human agent.';

    // 2️⃣ Store a system message in Firestore so inbox shows the change
    const systemMsgId = `system-ai-toggle-${Date.now()}`;
    const systemMsgRef = ticketRef.collection('messages').doc(systemMsgId);
    await systemMsgRef.set({
      from: 'System',
      role: 'system',
      body: statusText,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3️⃣ Optionally notify user via WhatsApp
    const companyTwilioClient =
      company.twilioAccountSid && company.twilioAuthToken
        ? twilio(company.twilioAccountSid, company.twilioAuthToken)
        : null;

    if (!companyTwilioClient || !company.twilioPhoneNumber || !to) {
      if (!companyTwilioClient || !company.twilioPhoneNumber) {
        console.warn(
          `⚠️ Company ${tenantId} Twilio not configured; stored AI toggle system message but did not send WhatsApp notification.`
        );
      }
    } else {
      try {
        const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        const fromWhatsApp = company.twilioPhoneNumber.startsWith('whatsapp:')
          ? company.twilioPhoneNumber
          : `whatsapp:${company.twilioPhoneNumber}`;

        await companyTwilioClient.messages.create({
          from: fromWhatsApp,
          to: toWhatsApp,
          body: statusText,
        });

        console.log(
          `📤 Sent AI status notification to ${toWhatsApp}: "${statusText}"`
        );
      } catch (twilioErr) {
        console.error(
          '❌ Error sending AI status notification via Twilio:',
          twilioErr?.response?.data || twilioErr
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /api/agent/toggle-ai:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

