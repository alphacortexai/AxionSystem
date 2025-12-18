// Twilio Status Callback Webhook
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
    }
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
          console.error('❌ Error initializing Firebase Admin at runtime:', error.message);
          return NextResponse.json({ error: 'Firebase configuration error' }, { status: 500 });
        }
      }
    }

    const formData = await request.formData();
    const messageSid = formData.get('MessageSid');
    const messageStatus = formData.get('MessageStatus');
    const errorCode = formData.get('ErrorCode');
    const errorMessage = formData.get('ErrorMessage');

    console.log(`📬 Twilio status callback received:`, {
      messageSid,
      messageStatus,
      errorCode,
      errorMessage
    });

    if (!messageSid || !messageStatus) {
      console.warn('⚠️ Missing MessageSid or MessageStatus in callback');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = admin.firestore();

    // Find the message with this Twilio SID across all companies and tickets
    // This is a bit expensive but necessary since we don't have the company/ticket ID in the callback
    const companiesSnapshot = await db.collection('companies').get();

    let messageFound = false;

    for (const companyDoc of companiesSnapshot.docs) {
      const ticketsSnapshot = await db
        .collection('companies')
        .doc(companyDoc.id)
        .collection('tickets')
        .get();

      for (const ticketDoc of ticketsSnapshot.docs) {
        const messagesSnapshot = await db
          .collection('companies')
          .doc(companyDoc.id)
          .collection('tickets')
          .doc(ticketDoc.id)
          .collection('messages')
          .where('twilioMessageSid', '==', messageSid)
          .limit(1)
          .get();

        if (!messagesSnapshot.empty) {
          const messageDoc = messagesSnapshot.docs[0];
          
          // Update message with delivery status
          const updateData = {
            deliveryStatus: messageStatus,
            lastStatusUpdate: admin.firestore.FieldValue.serverTimestamp()
          };

          // Add error information if present
          if (errorCode) {
            updateData.deliveryError = {
              code: errorCode,
              message: errorMessage || 'Unknown error'
            };
          }

          await messageDoc.ref.update(updateData);

          console.log(`✅ Updated message ${messageDoc.id} status to: ${messageStatus}`);
          messageFound = true;
          break;
        }
      }

      if (messageFound) break;
    }

    if (!messageFound) {
      console.warn(`⚠️ Message with SID ${messageSid} not found in database`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error processing Twilio status callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
