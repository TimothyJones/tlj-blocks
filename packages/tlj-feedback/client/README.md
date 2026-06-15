# @tlj-blocks/feedback-client

A tiny, dependency-free connector for submitting user feedback to a
[`@tlj-blocks/feedback-cdk`](../cdk) endpoint (a Lambda Function URL that emails feedback
via SNS). Works in any browser or runtime with `fetch`.

## Install

```sh
npm install @tlj-blocks/feedback-client
```

## Usage

```ts
import { submitFeedback } from "@tlj-blocks/feedback-client";

await submitFeedback({
  endpoint: "https://<your-function-url>.lambda-url.us-east-1.on.aws/",
  feedback: {
    type: "bug", // "bug" | "feature"
    title: "Save button does nothing",
    description: "Clicking Save on the settings page has no effect.",
  },
});
```

### With auth

Pass a bearer token (or a function that returns one) and it is sent as
`Authorization: Bearer <token>`:

```ts
await submitFeedback({
  endpoint,
  feedback,
  authToken: () => auth.tokens.idToken, // string | () => string | Promise<string>
});
```

## API

`submitFeedback(options)` — resolves on success, throws `FeedbackError` on
invalid input or a non-OK response (`error.status` holds the HTTP status).

| Option      | Type                                        | Notes                             |
| ----------- | ------------------------------------------- | --------------------------------- |
| `endpoint`  | `string`                                    | Absolute feedback URL. Required.  |
| `feedback`  | `{ type, title, description }`              | `type` is `"bug"` or `"feature"`. |
| `authToken` | `string \| () => string \| Promise<string>` | Optional bearer token.            |
| `fetch`     | `typeof fetch`                              | Defaults to `globalThis.fetch`.   |
| `headers`   | `Record<string, string>`                    | Extra request headers.            |
| `signal`    | `AbortSignal`                               | Optional cancellation signal.     |
