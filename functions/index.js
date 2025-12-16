// Cloud Functions entrypoint for AxionSystem
// Converts uploaded voice notes (WebM, etc.) to OGG/Opus for Twilio WhatsApp

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const twilio = require('twilio');
const os = require('os');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const storage = admin.storage();

ffmpeg.setFfmpegPath(ffmpegPath);

exports.convertVoiceNoteToOgg = functions.storage
  .object()
  .onFinalize(async (object) => {
    const contentType = object.contentType || '';
    const filePath = object.name; // e.g. companies/tenant/voice-notes/....webm

    console.log('🧩 convertVoiceNoteToOgg triggered for', {
      filePath,
      contentType,
      bucket: object.bucket,
      fileName,
      tempInput,
      tempOutput,
      convertedPath,
    });

    // Guard clauses: only audio in our voice-notes path, and skip already converted files
    if (!filePath) {
      console.log('⚪ No filePath on object; exiting.');
      return null;
    }

    if (!contentType.startsWith('audio/')) {
      console.log('⚪ Not an audio file; exiting.');
      return null;
    }

    if (!filePath.includes('/voice-notes/')) {
      console.log('⚪ File not in /voice-notes/ path; exiting.');
      return null;
    }

    if (filePath.includes('/voice-notes/converted/')) {
      console.log('⚪ Already in converted folder; exiting.');
      return null;
    }

    const bucket = storage.bucket(object.bucket);
    const fileName = path.basename(filePath);
    const tempInput = path.join(os.tmpdir(), `input-${fileName}`);
    const tempOutput = path.join(os.tmpdir(), `output-${fileName.replace(/\.[^.]+$/, '')}.ogg`);

    // Calculate the final OGG filename for storage
    const oggName = fileName.replace(/\.[^.]+$/, '.ogg');
    const convertedPath = filePath
      .replace('/voice-notes/', '/voice-notes/converted/')
      .replace(fileName, oggName);

    try {
      // If it's already audio/ogg, just copy to the converted folder (no re-encode)
      if (contentType === 'audio/ogg') {
        console.log('🎧 File is already audio/ogg; copying to converted path:', convertedPath);
        await bucket.file(filePath).copy(bucket.file(convertedPath));
        console.log('✅ Copied OGG file to', convertedPath);
        return null;
      }

      console.log('⬇️ Downloading original audio to', tempInput);
      await bucket.file(filePath).download({ destination: tempInput });

      console.log('🎬 Running ffmpeg to convert to OGG/Opus...');
      await new Promise((resolve, reject) => {
        ffmpeg(tempInput)
          .audioCodec('libopus')
          .audioBitrate('32k')
          .format('ogg')
          .output(tempOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      console.log('⬆️ Uploading converted OGG to', convertedPath);
      await bucket.upload(tempOutput, {
        destination: convertedPath,
        metadata: { contentType: 'audio/ogg' },
      });

      console.log('✅ Conversion complete for', filePath, '->', convertedPath);
    } catch (err) {
      console.error('❌ Error converting voice note to OGG:', err);
    } finally {
      // Clean up tmp files
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      } catch (cleanupErr) {
        console.error('⚠️ Error cleaning up temp files:', cleanupErr);
      }
    }

    return null;
  });

// Scheduled function to retry sending voice notes that failed initial conversion
exports.retryVoiceNoteDelivery = functions.pubsub
  .schedule('every 2 minutes')
  .onRun(async (context) => {
    console.log('🔄 Running voice note delivery retry check...');

    try {
      const db = admin.firestore();

      // Find all companies
      const companiesSnap = await db.collection('companies').get();
      let totalPendingMessages = 0;
      let totalSentMessages = 0;

      for (const companyDoc of companiesSnap.docs) {
        const tenantId = companyDoc.id;
        const company = companyDoc.data();

        console.log(`🏢 Checking company: ${tenantId}`);

        // Find all tickets for this company
        const ticketsSnap = await companyDoc.ref.collection('tickets').get();

        for (const ticketDoc of ticketsSnap.docs) {
          const ticketId = ticketDoc.id;

          // Find messages with voiceNotePath but no mediaUrl
          const pendingMessagesSnap = await ticketDoc.ref.collection('messages')
            .where('voiceNotePath', '!=', null)
            .where('media', '==', null)
            .get();

          if (!pendingMessagesSnap.empty) {
            console.log(`📋 Found ${pendingMessagesSnap.size} pending voice note messages in ticket ${ticketId}`);

            for (const messageDoc of pendingMessagesSnap.docs) {
              const messageData = messageDoc.data();
              const voiceNotePath = messageData.voiceNotePath;

              console.log(`🎵 Processing pending voice note: ${voiceNotePath}`);

              try {
                // Build the expected OGG path
                const oggPath = voiceNotePath
                  .replace('/voice-notes/', '/voice-notes/converted/')
                  .replace(/\.[^.]+$/, '.ogg');

                console.log(`🔍 Checking for converted OGG at: ${oggPath}`);

                // Check if OGG file exists
                const bucket = storage.bucket();
                const [exists] = await bucket.file(oggPath).exists();

                if (exists) {
                  console.log(`✅ OGG file found! Generating signed URL...`);

                  // Generate signed URL for the OGG file
                  const [signedUrl] = await bucket.file(oggPath).getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 60 * 60 * 1000, // 1 hour
                  });

                  console.log(`🔗 Signed URL generated: ${signedUrl.substring(0, 50)}...`);

                  // Update message with media information
                  await messageDoc.ref.update({
                    media: [{
                      url: signedUrl,
                      contentType: 'audio/ogg',
                      index: 0
                    }],
                    hasMedia: true,
                    voiceNotePath: admin.firestore.FieldValue.delete(), // Remove the path since it's now resolved
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  // Now try to send to Twilio if company has Twilio configured
                  if (company.twilioAccountSid && company.twilioAuthToken && company.twilioPhoneNumber) {
                    const twilioClient = twilio(company.twilioAccountSid, company.twilioAuthToken);

                    // Get ticket data to find recipient
                    const ticketData = ticketDoc.data();
                    const to = ticketData.customerId;

                    if (to) {
                      const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
                      const fromWhatsApp = company.twilioPhoneNumber.startsWith("whatsapp:")
                        ? company.twilioPhoneNumber
                        : `whatsapp:${company.twilioPhoneNumber}`;

                      // Check if message has text content
                      const hasText = messageData.body && messageData.body.trim();

                      const messageParams = {
                        from: fromWhatsApp,
                        to: toWhatsApp,
                        mediaUrl: [signedUrl],
                      };

                      // Add text content if present
                      if (hasText) {
                        // Remove attribution from text (e.g., "<AI>" at the end)
                        const cleanText = messageData.body.replace(/\s*<[^>]*>$/, '');
                        messageParams.body = cleanText;
                      }

                      console.log(`📤 Sending delayed voice note to ${toWhatsApp}...`);

                      try {
                        const result = await twilioClient.messages.create(messageParams);
                        console.log(`✅ Delayed voice note sent successfully: ${result.sid}`);

                        // Add a system message noting the delayed delivery
                        const systemMsgRef = ticketDoc.ref.collection('messages').doc(`system-delayed-send-${Date.now()}`);
                        await systemMsgRef.set({
                          from: "System",
                          role: "system",
                          body: `✅ Voice note successfully delivered (delayed processing).`,
                          createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });

                        totalSentMessages++;
                      } catch (twilioErr) {
                        console.error('❌ Error sending delayed voice note via Twilio:', twilioErr.message);

                        // Log the error in the conversation
                        const errorMsgRef = ticketDoc.ref.collection('messages').doc(`system-twilio-retry-error-${Date.now()}`);
                        await errorMsgRef.set({
                          from: "System",
                          role: "system",
                          body: `❌ Failed to send delayed voice note: ${twilioErr.message}`,
                          createdAt: admin.firestore.FieldValue.serverTimestamp(),
                          error: {
                            code: twilioErr.code || 'UNKNOWN',
                            message: twilioErr.message,
                          },
                        });
                      }
                    } else {
                      console.warn('⚠️ No customer ID found for ticket, cannot send delayed message');
                    }
                  } else {
                    console.warn('⚠️ Twilio not configured for company, voice note updated but not sent');
                  }

                  totalPendingMessages++;
                } else {
                  console.log(`⏳ OGG file still not ready for ${oggPath}, will retry later`);
                }
              } catch (messageErr) {
                console.error(`❌ Error processing pending voice note ${voiceNotePath}:`, messageErr);
              }
            }
          }
        }
      }

      console.log(`🎯 Voice note retry check complete: ${totalPendingMessages} messages processed, ${totalSentMessages} sent`);

      return null;
    } catch (error) {
      console.error('❌ Error in voice note delivery retry:', error);
      return null;
    }
  });

