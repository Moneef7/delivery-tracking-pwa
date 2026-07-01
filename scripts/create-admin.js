// Script to create the first admin user
// Run with: node scripts/create-admin.js

const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
// You need to download the service account key from Firebase Console
// Go to: Project Settings > Service accounts > Generate new private key

const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function createAdmin() {
    const email = 'your-admin-email@example.com'; // Change this to your admin email
    const password = 'YourStrongPassword123!'; // Change this to a strong password
    const name = 'Admin User'; // Change this to admin name
    const phone = '+000000000000'; // Change this to admin phone

    try {
        // Create Firebase Auth user
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: name,
            disabled: false
        });

        console.log('Auth user created:', userRecord.uid);

        // Create Firestore user document
        await db.collection('users').doc(userRecord.uid).set({
            name: name,
            phone: phone,
            email: email,
            role: 'admin',
            status: 'active',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Firestore user document created');
        console.log('');
        console.log('============================================');
        console.log('Admin user created successfully!');
        console.log('============================================');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log('============================================');
        console.log('');
        console.log('IMPORTANT: Change the password after first login!');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin();
