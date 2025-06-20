import { spawn } from 'child_process';
import { config } from 'dotenv';
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';
config();
const credentialsPath = path.join(import.meta.url, '../../google_account_credentials.json').replace("file:", "");
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));


const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    credentials
});

const drive = google.drive({ version: 'v3', auth });

async function backupPostgresToDrive() {
    const pgDump = spawn('pg_dump', [
        '--no-owner',
        '--no-acl',
        '--format=plain',
        `--dbname=${process.env.DATABASE_URL!}`,
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
