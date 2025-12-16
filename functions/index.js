// Cloud Functions entrypoint for AxionSystem
// Converts uploaded voice notes (WebM, etc.) to OGG/Opus for Twilio WhatsApp

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
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
    const tempInput = path.join(os.tmpdir(), fileName);
    const oggName = fileName.replace(/\.[^.]+$/, '.ogg');
    const tempOutput = path.join(os.tmpdir(), oggName);

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


