import { spawn } from "child_process";

export async function runChildProcess(
  command: string,
  args: string[],
  dataToWrite: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args);

    let output = "";

    // Capture stdout data
    childProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    // Handle errors
    childProcess.stderr.on("data", (data) => {
      reject(new Error(`Child process error: ${data.toString()}`));
    });

    // Resolve when the child process exits
    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });

    // Write data to stdin
    childProcess.stdin.write(dataToWrite);
    childProcess.stdin.end(); // Signal end of input
  });
}
