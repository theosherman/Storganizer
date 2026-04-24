export type UploadResult = {
  ok: boolean;
  status: number;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
};

export function uploadWithProgress(
  url: string,
  formData: FormData,
  opts: { onProgress?: (p: number) => void; signal?: AbortSignal } = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    if (opts.onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) opts.onProgress!(e.loaded / e.total);
      });
      xhr.upload.addEventListener("load", () => opts.onProgress!(1));
    }
    xhr.addEventListener("load", () => {
      const text = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async <T>() => JSON.parse(text) as T,
        text: async () => text,
      });
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError"))
    );

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}
