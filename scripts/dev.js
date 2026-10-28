const { spawn } = require("child_process");
const net = require("net");

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function start() {
  let port = 3000;
  while (!(await checkPort(port))) {
    port++;
  }
  console.log(`Starting Next.js on port ${port}`);
  const child = spawn("next", ["dev", "-p", String(port)], {
    stdio: "inherit",
    shell: true,
  });
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
}

start();
