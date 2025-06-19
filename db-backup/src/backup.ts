import { spawn } from 'child_process';
import 'dotenv/config';
import { google } from 'googleapis';
import { Readable } from 'stream';


const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
});

const drive = google.drive({ version: 'v3', auth });

async function backupPostgresToDrive() {
    const pgDump = spawn('pg_dump', [
        '--no-owner',
        '--no-acl',
        '--format=plain',
        process.env.DATABASE_URL as string,
    ]);

    const fileName = `pg_backup_${new Date().toISOString()}.sql`;

    const upload = await drive.files.create({
        requestBody: {
            name: fileName,
            mimeType: 'application/sql',
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
        },
        media: {
            mimeType: 'application/sql',
            body: pgDump.stdout as Readable,
        },
        fields: 'id',
    });

    console.log('✅ Backup uploaded:', upload.data.id);

    pgDump.stderr?.on('data', (data) =>
        console.error('pg_dump error:', data.toString())
    );
    pgDump.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ pg_dump failed with code ${code}`);
        }
    });
}

backupPostgresToDrive().catch(console.error);
