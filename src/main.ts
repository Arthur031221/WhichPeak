import "./style.css";
import { App } from "./app/app";

const app = new App();
app.start();
// Handy for debugging and for the end to end tests.
(window as unknown as { whichpeak: App }).whichpeak = app;
