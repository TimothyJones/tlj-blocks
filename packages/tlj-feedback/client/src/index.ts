/**
 * tlj-feedback-client — a small, dependency-free connector for submitting
 * user feedback to a tlj-feedback endpoint (see the `tlj-feedback-cdk` package
 * for the matching backend).
 */

export type FeedbackType = "bug" | "feature";

export interface FeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
}

/** A bearer token, or a (possibly async) function that returns one. */
export type AuthTokenProvider = string | (() => string | Promise<string>);

export interface SubmitFeedbackOptions {
  /** Absolute URL of the feedback endpoint, e.g. `https://api.example.com/feedback`. */
  endpoint: string;
  /** The feedback to submit. */
  feedback: FeedbackPayload;
  /**
   * Optional bearer token (or a function returning one). When provided it is
   * sent as `Authorization: Bearer <token>`.
   */
  authToken?: AuthTokenProvider;
  /** Optional `fetch` implementation. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Extra headers merged into the request. */
  headers?: Record<string, string>;
  /** Optional `AbortSignal` to cancel the request. */
  signal?: AbortSignal;
}

/** Error thrown when a feedback submission fails validation or the request. */
export class FeedbackError extends Error {
  /** HTTP status code, when the failure came from a response. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FeedbackError";
    this.status = status;
  }
}

/**
 * Submit feedback to a tlj-feedback endpoint.
 *
 * Validates the payload, POSTs it as JSON, and resolves on a 2xx response.
 * Throws {@link FeedbackError} on invalid input or a non-OK response.
 */
export async function submitFeedback(
  options: SubmitFeedbackOptions,
): Promise<void> {
  const { endpoint, feedback, authToken, headers, signal } = options;

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new FeedbackError(
      "No fetch implementation available; pass options.fetch",
    );
  }

  validateFeedback(feedback);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (authToken !== undefined) {
    const token =
      typeof authToken === "function" ? await authToken() : authToken;
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(feedback),
    signal,
  });

  if (!res.ok) {
    throw new FeedbackError(
      `POST ${endpoint} failed: ${res.status}`,
      res.status,
    );
  }
}

function validateFeedback(feedback: FeedbackPayload): void {
  if (!feedback || (feedback.type !== "bug" && feedback.type !== "feature")) {
    throw new FeedbackError("feedback.type must be 'bug' or 'feature'");
  }
  if (!feedback.title || !feedback.title.trim()) {
    throw new FeedbackError("feedback.title is required");
  }
  if (!feedback.description || !feedback.description.trim()) {
    throw new FeedbackError("feedback.description is required");
  }
}
