import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer P> ? P : never;

type Step = { toolCall: { name: string; input: Record<string, unknown> } } | { text: string };

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/**
 * A model that plays back a fixed script: each step is one model call that
 * either requests a tool or answers with text.
 */
export function scriptedModel(steps: Step[]) {
  return new MockLanguageModelV4({
    doStream: steps.map((step, i) => ({
      stream: simulateReadableStream<StreamPart>({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks:
          "toolCall" in step
            ? [
                {
                  type: "tool-call",
                  toolCallId: `call-${i}`,
                  toolName: step.toolCall.name,
                  input: JSON.stringify(step.toolCall.input),
                },
                { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
              ]
            : [
                { type: "text-start", id: `text-${i}` },
                { type: "text-delta", id: `text-${i}`, delta: step.text },
                { type: "text-end", id: `text-${i}` },
                { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
              ],
      }),
    })),
  });
}

/** Everything the model was sent on a given call, flattened for easy matching. */
export function promptText(model: MockLanguageModelV4, call: number): string {
  return JSON.stringify(model.doStreamCalls[call]?.prompt ?? null);
}
