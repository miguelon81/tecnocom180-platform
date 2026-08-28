import { app } from "./app";
import "./services/mqtt";

const PORT = 3000;

app.listen(PORT, () => {
  console.log(
    `TECNOCOM180 API running on port ${PORT}`
  );
});