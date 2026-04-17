import type { Env } from "../env";

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
      const imageArray = [...new Uint8Array(imageBytes)];

      const aiResponse = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
        messages: [
          {
            role: "user",
            content: "What is this object? Provide a short, specific label (e.g. 'USB-C to Lightning cable' or 'Arduino Nano microcontroller'). Just the label, nothing else.",
          },
        ],
        image: imageArray,
      }) as { response?: string };

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
