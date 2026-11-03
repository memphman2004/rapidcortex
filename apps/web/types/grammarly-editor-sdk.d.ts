declare module "@grammarly/editor-sdk" {
  export type EditorSDK = {
    addPlugin: (
      element: HTMLElement,
      config?: Record<string, unknown>,
      viewport?: HTMLElement,
    ) => unknown;
  };

  export function init(clientId: string, config?: Record<string, unknown>): Promise<EditorSDK>;
  export function init(): Promise<void>;
}
