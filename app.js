import fs from 'fs';
import path from "path";
import { execSync } from 'child_process';
const publicFile = path.join(process.cwd(), 'public_html', "index.html");
if (fs.existsSync(publicFile)) {
    fs.rmSync(publicFile);
}
const whiteList = {
    "dirs": ['.builds', '.git', 'tmp'],
    "files": [".htaccess"]
}

// move all files from this directory to the parent directory
const filesToMove = fs.readdirSync('.', {
    encoding: 'utf-8',
    withFileTypes: true,
}).filter((file) => {
    if (file.isDirectory()) {
        return !whiteList.dirs.includes(file.name);
    }
    return !whiteList.files.includes(file.name);
});

// move up directory 
filesToMove.forEach((file) => {
    const oldPath = path.join(process.cwd(), file.name);
    const newPath = path.join(process.cwd(), '..', file.name);
    if (fs.existsSync(newPath)) {
        fs.rmSync(newPath, { recursive: true, force: true });
    }
    fs.renameSync(oldPath, newPath);
});

const htaccessPath = path.join(process.cwd(), '.htaccess');
if (fs.existsSync(htaccessPath)) {
    const htaccessFile = fs.readFileSync(htaccessPath, 'utf-8');
    const newHtaccessFile = htaccessFile.replace("/public_html", "").replace("app.js", "start.js");
    fs.writeFileSync(htaccessPath, newHtaccessFile);
}

console.log("DONE moving files");

execSync(`node start.js`, {
    stdio: 'inherit',
    cwd: path.join(process.cwd(), '../')
});


// replace public_html with nothing
const htaccessFile = fs.readFileSync('.htaccess', 'utf-8');
const newHtaccessFile = htaccessFile.replace(/\/public_html/g, '').replace(/app.js/g, 'dist/server/index.js')
fs.writeFileSync('.htaccess', newHtaccessFile);
