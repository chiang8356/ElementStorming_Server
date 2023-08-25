const tunnel = require("tunnel-ssh");
const sshOptions = {
  host: "159.203.43.57",
  port: 22,
  username: "root",
  password: "eeit64ES",
};

const forwardOptions = {
  srcAddr: "localhost",
  srcPort: 27017,
  dstAddr: "localhost",
  dstPort: 27017,
};

let tunnelOptions = {
  autoClose: false,
};

let serverOptions = {
  port: 27017,
};

tunnel
  .createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions)
  .then(([server, conn], error) => {
    server.on("error", (e) => {
      console.log(e);
    });

    conn.on("error", (e) => {
      console.log(e);
    });

    server.on("connection", (connection) => {
      console.log("connection ok");
    });

    conn.on("connection", (e) => {
      console.log("new connection");
    });
  });
