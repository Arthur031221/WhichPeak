import "./style.css";
import { App } from "./app/app";

const app = new App();
app.start();
// Handy for debugging and for the end to end tests.
(window as unknown as { whichpeak: App }).whichpeak = app;

// Keeps the page and the terrain tiles it has already fetched available offline.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
