import { app } from "./app";
import "./services/mqtt";

const PORT = 3000;
const HOST = process.env.API_HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(
    `TECNOCOM180 API running on http://${HOST}:${PORT}`
  );
});