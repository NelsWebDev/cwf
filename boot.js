import { spawn } from "node:child_process";

const child = spawn("yarn", ["start"], {
    stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr are streams
});

// Send data to child's stdin
child.stdin.write("hello\n");
child.stdin.end(); // close stdin when done

// Read child's stdout
child.stdout.on("data", (chunk) => {
    process.stdout.write("child stdout: " + chunk);
});

// Read child's stderr
child.stderr.on("data", (chunk) => {
    process.stderr.write("child stderr: " + chunk);
});

child.on("close", (code) => {
    console.log("child exited with code", code);
});