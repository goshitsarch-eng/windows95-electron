import { createRoot } from "react-dom/client";

export interface Win95Window extends Window {
  emulator: any;
  win95: {
    app: App;
  };
}

declare let window: Win95Window;

/**
 * The top-level class controlling the whole app. This is *not* a React component,
 * but it does eventually render all components.
 *
 * @class App
 */
export class App {
  /**
   * Initial setup call, loading Monaco and kicking off the React
   * render process.
   */
  public async setup(): Promise<void> {
    const { Emulator } = await import("./emulator");

    const className = `${process.platform}`;
    const app = (
      <div className={className}>
        <Emulator />
      </div>
    );

    const container = document.getElementById("app");
    if (container) {
      const root = createRoot(container);
      root.render(app);
    }
  }
}

window.win95 = window.win95 || {
  app: new App(),
};

window.win95.app.setup();
