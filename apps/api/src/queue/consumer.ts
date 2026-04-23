import type { Env } from "../env";

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function handleImageQueue(
  batch: MessageBatch<{ item_id: string; photo_r2_key: string }>,
  env: Env
) {
  for (const message of batch.messages) {
    const { item_id, photo_r2_key } = message.body;
    try {
      const object = await env.STORAGE.get(photo_r2_key);
      if (!object) throw new Error(`Image not found: ${photo_r2_key}`);

      const imageBytes = await object.arrayBuffer();
      const contentType = object.httpMetadata?.contentType || "image/jpeg";
      const dataUri = `data:${contentType};base64,${bytesToBase64(imageBytes)}`;

      const aiResponse = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What is this object? Provide a short, specific label (e.g. 'USB-C to Lightning cable' or 'Arduino Nano microcontroller'). Just the label, nothing else.",
              },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
      } as unknown as AiTextGenerationInput) as { response?: string };

      const label = aiResponse.response?.trim() || "Unknown item";

      await env.DB.prepare(
        "UPDATE items SET name = ?, ai_label = ?, status = 'ready' WHERE id = ?"
      ).bind(label, label, item_id).run();
    } catch (error) {
      console.error(`Failed to process item ${item_id}:`, error);
      await env.DB.prepare(
        "UPDATE items SET name = 'Unknown item', status = 'ready' WHERE id = ?"
      ).bind(item_id).run();
    }
    message.ack();
  }
  batch.ackAll();
}
