import { test } from "node:test";
import assert from "node:assert/strict";
import { submitFeedback, FeedbackError } from "../dist/index.js";

test("posts feedback to the endpoint with a bearer token", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };

  await submitFeedback({
    endpoint: "https://example.com/feedback",
    feedback: { type: "bug", title: "T", description: "D" },
    authToken: "token123",
    fetch: fakeFetch,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.com/feedback");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers["Authorization"], "Bearer token123");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    type: "bug",
    title: "T",
    description: "D",
  });
});

test("supports an async auth-token provider", async () => {
  let header;
  const fakeFetch = async (_url, init) => {
    header = init.headers["Authorization"];
    return { ok: true, status: 200 };
  };

  await submitFeedback({
    endpoint: "https://example.com/feedback",
    feedback: { type: "feature", title: "T", description: "D" },
    authToken: async () => "async-token",
    fetch: fakeFetch,
  });

  assert.equal(header, "Bearer async-token");
});

test("throws FeedbackError on a non-ok response", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500 });

  await assert.rejects(
    submitFeedback({
      endpoint: "https://example.com/feedback",
      feedback: { type: "feature", title: "T", description: "D" },
      fetch: fakeFetch,
    }),
    (err) => err instanceof FeedbackError && err.status === 500,
  );
});

test("validates the payload before sending", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
    return { ok: true, status: 200 };
  };

  await assert.rejects(
    submitFeedback({
      endpoint: "https://example.com/feedback",
      feedback: { type: "bug", title: "", description: "D" },
      fetch: fakeFetch,
    }),
    FeedbackError,
  );
  assert.equal(called, false);
});
