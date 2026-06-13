# tlj-feedback-cdk

An AWS CDK construct that stands up a feedback receiver: a Lambda behind a
[Function URL](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
that accepts `{ type, title, description }` POSTs and publishes them to an SNS
topic, which emails a configured address.

Pair it with [`tlj-feedback-client`](../client) on the frontend.

## Install

```sh
npm install tlj-feedback-cdk
# peers (provided by your CDK app):
npm install aws-cdk-lib constructs
```

## Usage

```ts
import { Feedback } from "tlj-feedback-cdk";

class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const feedback = new Feedback(this, "Feedback", {
      feedbackEmail: "team@example.com",
      appName: "MyApp",
      // allowedOrigins: ["https://app.example.com", "http://localhost:5173"],
    });

    new CfnOutput(this, "FeedbackUrl", {
      value: feedback.functionUrl.url,
    });
  }
}
```

After first deploy, AWS sends a **subscription confirmation** email to
`feedbackEmail` — confirm it to start receiving feedback.

Give the printed Function URL to the client:

```ts
await submitFeedback({ endpoint: feedbackUrl, feedback });
```

## Props

| Prop             | Type             | Default       | Notes                                          |
| ---------------- | ---------------- | ------------- | ---------------------------------------------- |
| `feedbackEmail`  | `string`         | —             | Required. Recipient of feedback notifications. |
| `appName`        | `string`         | `"App"`       | Used in topic display name + email subject.    |
| `topicName`      | `string`         | generated     | Explicit SNS topic name.                       |
| `allowedOrigins` | `string[]`       | `["*"]`       | CORS origins for the Function URL.             |
| `runtime`        | `lambda.Runtime` | `NODEJS_22_X` | Lambda runtime.                                |

## Exposed members

`topic` (`sns.Topic`), `handler` (`lambda.Function`), `functionUrl`
(`lambda.FunctionUrl`).

## Note on auth

The Function URL is **public** (`authType: NONE`) — anyone with the URL can POST
feedback, matching the reference setup. The handler reads an optional `email`
field from the body for the notification. If you later need authenticated
submissions, front it with your own authorizer / API Gateway, or extend the
construct.
