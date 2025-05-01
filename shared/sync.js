const path = require('path');
const fs = require('fs');

const sourceFile = path.join(__dirname, "types.ts");
const backendFile = path.join(__dirname, "../backend/src/types/shared.ts");
const frontendFile = path.join(__dirname, "../frontend/src/types/shared.ts");

// watch sourceFile for changes, and copy to backendFile and frontendFile
fs.watchFile(sourceFile, (curr, prev) => {
    console.log(`File changed: ${sourceFile}`);
    fs.copyFile(sourceFile, backendFile, (err) => {
        if (err) throw err;
        console.log(`Copied to: ${backendFile}`);
    });
    fs.copyFile(sourceFile, frontendFile, (err) => {
        if (err) throw err;
        console.log(`Copied to: ${frontendFile}`);
    });
});