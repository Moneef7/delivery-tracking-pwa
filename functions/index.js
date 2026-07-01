const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

/**
 * Scheduled function to auto-delete invoices older than 30 days
 * Runs daily at 2:00 AM (Saudi Arabia time)
 */
exports.autoDeleteInvoices = functions
    .region('us-central1')
    .pubsub
    .schedule('0 2 * * *')
    .timeZone('Asia/Riyadh')
    .onRun(async (context) => {
        console.log('Starting auto-delete for invoices older than 30 days...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            const invoicesRef = db.collection('invoices');
            const snapshot = await invoicesRef
                .where('created_at', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();

            if (snapshot.empty) {
                console.log('No invoices to delete.');
                return null;
            }

            const batch = db.batch();
            let deleteCount = 0;

            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
                deleteCount++;
            });

            await batch.commit();
            console.log(`Successfully deleted ${deleteCount} invoices.`);

            // Log the auto-delete action
            await db.collection('logs').add({
                action: 'auto_delete',
                entity_type: 'invoice',
                entity_id: 'batch',
                user_id: 'system',
                user_name: 'System Auto-Delete',
                old_value: { count: deleteCount },
                new_value: null,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return null;
        } catch (error) {
            console.error('Error auto-deleting invoices:', error);
            return null;
        }
    });

/**
 * Scheduled function to auto-delete trips older than 30 days
 * Runs daily at 2:30 AM (Saudi Arabia time)
 */
exports.autoDeleteTrips = functions
    .region('us-central1')
    .pubsub
    .schedule('30 2 * * *')
    .timeZone('Asia/Riyadh')
    .onRun(async (context) => {
        console.log('Starting auto-delete for trips older than 30 days...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            const tripsRef = db.collection('trips');
            const snapshot = await tripsRef
                .where('created_at', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();

            if (snapshot.empty) {
                console.log('No trips to delete.');
                return null;
            }

            const batch = db.batch();
            let deleteCount = 0;

            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
                deleteCount++;
            });

            await batch.commit();
            console.log(`Successfully deleted ${deleteCount} trips.`);

            // Log the auto-delete action
            await db.collection('logs').add({
                action: 'auto_delete',
                entity_type: 'trip',
                entity_id: 'batch',
                user_id: 'system',
                user_name: 'System Auto-Delete',
                old_value: { count: deleteCount },
                new_value: null,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return null;
        } catch (error) {
            console.error('Error auto-deleting trips:', error);
            return null;
        }
    });

/**
 * Scheduled function to auto-delete images older than 30 days
 * Runs daily at 3:00 AM (Saudi Arabia time)
 */
exports.autoDeleteImages = functions
    .region('us-central1')
    .pubsub
    .schedule('0 3 * * *')
    .timeZone('Asia/Riyadh')
    .onRun(async (context) => {
        console.log('Starting auto-delete for images older than 30 days...');

        const now = new Date();

        try {
            const imagesRef = db.collection('images');
            const snapshot = await imagesRef
                .where('expires_at', '<', admin.firestore.Timestamp.fromDate(now))
                .get();

            if (snapshot.empty) {
                console.log('No images to delete.');
                return null;
            }

            let deleteCount = 0;
            const bucket = storage.bucket();

            for (const doc of snapshot.docs) {
                const imageData = doc.data();

                try {
                    // Delete from Storage
                    if (imageData.file_path) {
                        const file = bucket.file(imageData.file_path);
                        await file.delete().catch((err) => {
                            console.log(`Storage file not found: ${imageData.file_path}`);
                        });
                    }

                    // Delete from Firestore
                    await doc.ref.delete();
                    deleteCount++;
                } catch (err) {
                    console.error(`Error deleting image ${doc.id}:`, err);
                }
            }

            console.log(`Successfully deleted ${deleteCount} images.`);

            // Log the auto-delete action
            await db.collection('logs').add({
                action: 'auto_delete',
                entity_type: 'image',
                entity_id: 'batch',
                user_id: 'system',
                user_name: 'System Auto-Delete',
                old_value: { count: deleteCount },
                new_value: null,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return null;
        } catch (error) {
            console.error('Error auto-deleting images:', error);
            return null;
        }
    });

/**
 * HTTP function to manually trigger cleanup (for testing/admin use)
 */
exports.manualCleanup = functions
    .region('us-central1')
    .https
    .onCall(async (data, context) => {
        // Verify admin role
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger cleanup');
        }

        // Run cleanup...
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let invoiceCount = 0;
        let tripCount = 0;
        let imageCount = 0;

        // Delete old invoices
        const invoicesSnapshot = await db.collection('invoices')
            .where('created_at', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();

        for (const doc of invoicesSnapshot.docs) {
            await doc.ref.delete();
            invoiceCount++;
        }

        // Delete old trips
        const tripsSnapshot = await db.collection('trips')
            .where('created_at', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();

        for (const doc of tripsSnapshot.docs) {
            await doc.ref.delete();
            tripCount++;
        }

        // Delete expired images
        const now = new Date();
        const imagesSnapshot = await db.collection('images')
            .where('expires_at', '<', admin.firestore.Timestamp.fromDate(now))
            .get();

        const bucket = storage.bucket();
        for (const doc of imagesSnapshot.docs) {
            const imageData = doc.data();
            if (imageData.file_path) {
                try {
                    await bucket.file(imageData.file_path).delete();
                } catch (err) {
                    console.log(`File not found: ${imageData.file_path}`);
                }
            }
            await doc.ref.delete();
            imageCount++;
        }

        return {
            success: true,
            deletedInvoices: invoiceCount,
            deletedTrips: tripCount,
            deletedImages: imageCount
        };
    });
