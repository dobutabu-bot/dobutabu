const chunkLoadRecoveryScript = `
(() => {
  const retryKey = "buro-finans-chunk-recovery-v1";
  const retryParam = "__chunk_retry";
  let pageIsUnloading = false;

  function errorText(value) {
    if (typeof value === "string") return value;
    if (value && typeof value.message === "string") return value.message;
    return "";
  }

  function isChunkLoadFailure(event) {
    const targetSource =
      event && event.target && typeof event.target.src === "string"
        ? event.target.src
        : "";
    const message = errorText(
      event && (event.reason || event.error || event.message)
    );

    return /ChunkLoadError|Loading chunk [0-9]+ failed|\\/_next\\/static\\/chunks\\/.+\\.js/i.test(
      message + " " + targetSource
    );
  }

  function recover(event) {
    if (!isChunkLoadFailure(event)) return;
    if (pageIsUnloading || document.visibilityState === "hidden") return;
    if (window.sessionStorage.getItem(retryKey) === "pending") return;

    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    window.sessionStorage.setItem(retryKey, "pending");
    const url = new URL(window.location.href);
    url.searchParams.set(retryParam, String(Date.now()));
    window.location.replace(url.toString());
  }

  window.addEventListener("beforeunload", () => {
    pageIsUnloading = true;
  });
  window.addEventListener("pagehide", () => {
    pageIsUnloading = true;
  });
  window.addEventListener("error", recover, true);
  window.addEventListener("unhandledrejection", recover);

  window.addEventListener("load", () => {
    pageIsUnloading = false;
    window.setTimeout(() => {
      window.sessionStorage.removeItem(retryKey);
    }, 2000);
  });
})();
`;

export function ChunkLoadRecovery() {
  return (
    <script
      id="chunk-load-recovery"
      dangerouslySetInnerHTML={{ __html: chunkLoadRecoveryScript }}
    />
  );
}
