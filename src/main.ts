import "@mariozechner/pi-web-ui";
import "./styles.css";

const artifactsPanel = document.querySelector<HTMLDivElement>("#artifacts-panel");

if (artifactsPanel) {
  artifactsPanel.dataset.ready = "true";
}
