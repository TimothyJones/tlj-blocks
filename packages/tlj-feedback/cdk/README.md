# tlj-feedback-cdk

An AWS CDK construct that stands up a complete **feedback receiver** you can drop
into any CDK stack: a Lambda behind a public
[Function URL](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
that accepts `{ type, title, description }` POSTs and publishes them to an SNS
topic, which emails a configured address.

The Lambda handler is **bundled into this package**, so you don't need esbuild,
Docker, or any bundling setup in your own app — just instantiate the construct.

Pair it with [`tlj-feedback-client`](../client) on the frontend, or POST to the
endpoint directly (see [HTTP contract](#http-contract)).

```
 ┌──────────┐   POST {type,title,        ┌─────────┐  publish   ┌───────────┐  email
 │ frontend │──  description, email?} ──▶│ Lambda  │──────────▶ │ SNS topic │──────▶ you
 │ (client) │   (Lambda Function URL)    │ handler │            │           │
 └──────────┘                            └─────────┘            └───────────┘
```

## Install

```sh
npm install tlj-feedback-cdk
```

`aws-cdk-lib` and `constructs` are **peer dependencies** — your CDK app already
has them. If not:

```sh
npm install aws-cdk-lib constructs
```

> Requires `aws-cdk-lib` ^2.160.0 (for `lambda.Runtime.NODEJS_22_X`) and
> `constructs` ^10.

## Quick start

Add the construct to a stack. The only required prop is `feedbackEmail`.

```ts
// lib/my-stack.ts
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Feedback } from "tlj-feedback-cdk";

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const feedback = new Feedback(this, "Feedback", {
      feedbackEmail: "team@example.com",
      appName: "MyApp",
      // Lock CORS down to your real origins in production:
      allowedOrigins: ["https://app.example.com", "http://localhost:5173"],
    });

    // Expose the endpoint so you can hand it to the frontend.
    new CfnOutput(this, "FeedbackUrl", { value: feedback.functionUrl.url });
  }
}
```

```ts
// bin/app.ts
import { App } from "aws-cdk-lib";
import { MyStack } from "../lib/my-stack";

const app = new App();
new MyStack(app, "MyStack");
```

## Deploy & confirm

```sh
cdk deploy
```

1. After deploy, the stack output `FeedbackUrl` prints the endpoint URL.
2. AWS sends a **subscription confirmation** email to `feedbackEmail`. Open it
   and click **Confirm subscription** — until you do, no feedback is delivered.
3. Submit a test from your frontend (or `curl`, below). You should receive an
   email with the feedback.

## Wire up the frontend

Give the `FeedbackUrl` to the [`tlj-feedback-client`](../client):

```ts
import { submitFeedback } from "tlj-feedback-client";

await submitFeedback({
  endpoint: feedbackUrl, // the CfnOutput value, e.g. via a build-time env var
  feedback: {
    type: "bug", // "bug" | "feature"
    title: "Save button does nothing",
    description: "Clicking Save on the settings page has no effect.",
  },
});
```

## HTTP contract

You don't need the client — any HTTP caller works.

**Request** — `POST <functionUrl>` with `Content-Type: application/json`:

```json
{
  "type": "bug",
  "title": "Save button does nothing",
  "description": "Clicking Save on the settings page has no effect.",
  "email": "reporter@example.com"
}
```

- `type` — `"bug"` or `"feature"` (required)
- `title`, `description` — non-empty strings (required)
- `email` — optional; included in the notification when present

**Responses:**

| Status | Body                                                 | When                             |
| ------ | ---------------------------------------------------- | -------------------------------- |
| `200`  | `{ "success": true }`                                | Published to SNS                 |
| `400`  | `{ "error": "ValidationError", "message": "..." }`   | Missing/invalid body             |
| `500`  | `{ "error": "ConfigError" \| "InternalError", ... }` | Misconfig or SNS publish failure |

Try it:

```sh
curl -X POST "$FEEDBACK_URL" \
  -H "Content-Type: application/json" \
  -d '{"type":"feature","title":"Dark mode","description":"Please add a dark theme."}'
```

## Props

| Prop             | Type             | Default       | Notes                                          |
| ---------------- | ---------------- | ------------- | ---------------------------------------------- |
| `feedbackEmail`  | `string`         | —             | **Required.** Recipient of feedback emails.    |
| `appName`        | `string`         | `"App"`       | Topic display name + email subject prefix.     |
| `topicName`      | `string`         | generated     | Explicit SNS topic name.                       |
| `allowedOrigins` | `string[]`       | `["*"]`       | CORS origins allowed to call the Function URL. |
| `runtime`        | `lambda.Runtime` | `NODEJS_22_X` | Lambda runtime for the receiver.               |

## Exposed members

The construct surfaces the underlying resources so you can extend them:

| Member        | Type                 | Use it to…                                      |
| ------------- | -------------------- | ----------------------------------------------- |
| `functionUrl` | `lambda.FunctionUrl` | Read `.url` for the endpoint.                   |
| `topic`       | `sns.Topic`          | Add more subscribers (SMS, extra emails, etc.). |
| `handler`     | `lambda.Function`    | Add alarms, metrics, env vars, log retention.   |

### Example: notify a second address and alarm on errors

```ts
import { Subscription, SubscriptionProtocol } from "aws-cdk-lib/aws-sns";

const feedback = new Feedback(this, "Feedback", {
  feedbackEmail: "team@example.com",
});

// CC another mailbox.
new Subscription(this, "Cc", {
  topic: feedback.topic,
  protocol: SubscriptionProtocol.EMAIL,
  endpoint: "product@example.com",
});

// Alarm if the receiver starts erroring.
feedback.handler
  .metricErrors()
  .createAlarm(this, "FeedbackErrors", { threshold: 1, evaluationPeriods: 1 });
```

## Resources created

`AWS::SNS::Topic`, `AWS::SNS::Subscription` (email), `AWS::Lambda::Function`
(+ execution role with `sns:Publish` on the topic only), and
`AWS::Lambda::Url`.

## Authentication

The Function URL is **public** (`authType: NONE`) — anyone with the URL can POST
feedback. This suits anonymous in-app feedback. The handler reads an optional
`email` field from the body but does **not** verify identity. If you later need
authenticated submissions, front the handler with your own authorizer / API
Gateway, restrict `allowedOrigins`, or extend the construct.

## Troubleshooting

- **No emails arriving** — the SNS subscription is almost certainly unconfirmed.
  Check the inbox (and spam) for the AWS confirmation email and click the link.
- **CORS error in the browser** — add the page's origin to `allowedOrigins`.
- **`500 ConfigError`** — the Lambda is missing `FEEDBACK_TOPIC_ARN`; this is set
  by the construct, so it points to a manual edit of the function's config.
